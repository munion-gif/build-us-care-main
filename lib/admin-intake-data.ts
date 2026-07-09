// 새 "사진접수" 화면 전용 데이터 로딩 (기존 /admin/diagnoses 로직을 자체 복사 — 기존 화면 무영향)
import { formatServiceName } from "@/lib/format";
import { ORDER_PHOTO_VIEW_EXPIRES_IN, ORDER_PHOTOS_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

const DIAGNOSIS_SELECT =
  "id,order_id,service_type_code,service_code,image_urls,photos,result,confidence,reason,details,recommendation,raw_response,customer_name,customer_phone,created_at,is_test,orders(order_number,service_type_code,skus,special_requests,inquiry_photos,customers(name,phone,address_full,address_apt),homes(address_full,address_apt,postal_code))";

function relatedOrder(d: any) {
  return Array.isArray(d.orders) ? d.orders[0] : d.orders;
}
function imageInputs(d: any): string[] {
  const urls = Array.isArray(d.image_urls) ? d.image_urls : [];
  const photos = Array.isArray(d.photos) ? d.photos : [];
  return photos.length ? photos : urls;
}
function customerName(d: any) {
  return d.customer_name ?? d.raw_response?.customer?.name ?? relatedOrder(d)?.customers?.name ?? null;
}
function customerPhone(d: any) {
  return d.customer_phone ?? d.raw_response?.customer?.phone ?? relatedOrder(d)?.customers?.phone ?? null;
}
function addressLine(d: any) {
  const order = relatedOrder(d);
  const rawAddress = d.raw_response?.address;
  const full = rawAddress?.full || [rawAddress?.roadAddress, rawAddress?.detailAddress].filter(Boolean).join(" ");
  return (
    full ||
    [order?.homes?.address_full ?? order?.customers?.address_full, order?.homes?.address_apt ?? order?.customers?.address_apt]
      .filter(Boolean)
      .join(" ") ||
    "주소 미입력"
  );
}
function requestItem(d: any) {
  const order = relatedOrder(d);
  return d.raw_response?.item ?? formatServiceName(d.service_type_code ?? d.service_code ?? order?.service_type_code);
}
function requestMemo(d: any): string | null {
  const raw = d.raw_response ?? {};
  const memo = raw.memo ?? raw.message ?? raw.request ?? raw.note ?? raw.detail ?? raw.special_requests ?? null;
  return memo ? String(memo).trim() : null;
}
function orderNumberOf(d: any) {
  const order = relatedOrder(d);
  return order?.order_number ?? d.raw_response?.receipt_number ?? d.raw_response?.order_number ?? null;
}
function isUrl(v: string) {
  return /^https?:\/\//i.test(v);
}
function resultLabel(result?: string | null): { text: string; tone: "new" | "sent" | "talk" | "done" } {
  const r = String(result ?? "");
  if (!r) return { text: "새 접수", tone: "new" };
  if (["교체추천", "replace_recommended", "replacement_recommended"].includes(r)) return { text: "교체추천", tone: "talk" };
  if (["보류", "hold"].includes(r)) return { text: "추가 사진", tone: "talk" };
  if (["현장확인필요", "site_check_required"].includes(r)) return { text: "현장확인", tone: "talk" };
  if (["교체불필요", "no_replacement_needed", "not_needed"].includes(r)) return { text: "종료", tone: "done" };
  return { text: r, tone: "sent" };
}

export type IntakeItem = {
  id: string;
  orderNumber: string | null;
  name: string | null;
  phone: string | null;
  address: string;
  item: string;
  memo: string | null;
  photoCount: number;
  createdAt: string | null;
  status: { text: string; tone: "new" | "sent" | "talk" | "done" };
};

export type IntakeDetail = IntakeItem & { photos: string[] };

function toItem(d: any): IntakeItem {
  return {
    id: String(d.id),
    orderNumber: orderNumberOf(d),
    name: customerName(d),
    phone: customerPhone(d),
    address: addressLine(d),
    item: requestItem(d),
    memo: requestMemo(d),
    photoCount: imageInputs(d).length,
    createdAt: d.created_at ?? null,
    status: resultLabel(d.result)
  };
}

export async function getIntakeList(): Promise<{ items: IntakeItem[]; hasDb: boolean }> {
  if (!hasSupabaseEnv()) return { items: [], hasDb: false };
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("diagnoses")
    .select(DIAGNOSIS_SELECT)
    .or("is_test.is.null,is_test.eq.false")
    .order("created_at", { ascending: false })
    .limit(40);
  return { items: (data ?? []).map(toItem), hasDb: true };
}

export async function getIntakeDetail(id: string): Promise<IntakeDetail | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("diagnoses").select(DIAGNOSIS_SELECT).eq("id", id).maybeSingle();
  if (!data) return null;
  const raw = imageInputs(data).slice(0, 6);
  const photos = (
    await Promise.all(
      raw.map(async (photo) => {
        if (isUrl(photo)) return photo;
        const { data: signed } = await supabase.storage.from(ORDER_PHOTOS_BUCKET).createSignedUrl(photo, ORDER_PHOTO_VIEW_EXPIRES_IN);
        return signed?.signedUrl ?? null;
      })
    )
  ).filter((u): u is string => Boolean(u));
  return { ...toItem(data), photos };
}
