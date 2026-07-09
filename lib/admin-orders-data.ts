// "예약·주문" 화면 전용 데이터 로딩 (기존 /admin/orders 로직과 별개, 목업 카드 구조에 맞춤)
import { formatServiceName } from "@/lib/format";
import { buildQuoteDocumentInputFromOrderStatus, type QuoteDocumentInput } from "@/lib/quote-document";
import { ORDER_PHOTO_VIEW_EXPIRES_IN, ORDER_PHOTOS_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

const RELATIONS = `id,order_number,status,service_type_code,total_amount,online_payment_amount,created_at,inquiry_photos,is_test,deleted_at,
  customers(name,phone,address_full,address_apt),
  homes(address_full,address_apt,postal_code),
  payments(id,status,amount,method,provider,online_payment_amount,onsite_payment_amount,onsite_payment_status,requested_at),
  quotes(id,version,items,total_material,total_labor,total_final,visit_fee,discount,created_at),
  jobs(id,scheduled_at,scheduled_date,status,created_at),
  reservations(id,reserved_date,time_slot),
  cancellations(id,status,reason,requested_at)`;

export type Stage = "s-q" | "s-p" | "s-v" | "s-d" | "s-c";

export type OrderCard = {
  id: string;
  orderNumber: string | null;
  name: string;
  phone: string;
  address: string;
  stage: Stage;
  stageText: string;
  rawStatus: string;
  productSummary: string;
  amountText: string;
  payText: string;
  scheduleText: string;
  nextAction: string;
  buttonLabel: string;
  buttonTone: "b-pri" | "b-warn" | "b-dan" | "b-ghost";
  buttonAction: "confirm-payment" | "confirm-reservation" | "cancel" | "detail";
  cancellationId: string | null;
  photos: string[];
  doc: QuoteDocumentInput;
};

export type OrdersOverview = {
  hasDb: boolean;
  pipe: { quote: number; payment: number; visit: number; done: number; issue: number };
  todo: OrderCard[];
  active: OrderCard[];
};

function asArray<T>(v: any): T[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}
function one(v: any): any {
  return Array.isArray(v) ? v[0] : v;
}
function won(n: number) {
  return `${Number(n || 0).toLocaleString("ko-KR")}원`;
}
function slotLabel(slot?: string | null) {
  if (slot === "morning") return "오전";
  if (slot === "afternoon") return "오후";
  return "";
}
function kstDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
function slotFromAt(value?: string | null) {
  if (!value) return null;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(new Date(value)));
  return hour < 13 ? "morning" : "afternoon";
}

function scheduleText(order: any): string {
  const job = asArray<any>(order.jobs).filter((j) => j.status !== "cancelled").sort((a, b) => String(b.scheduled_at ?? "").localeCompare(String(a.scheduled_at ?? "")))[0];
  if (job?.scheduled_at) return `${kstDate(job.scheduled_at)} ${slotLabel(slotFromAt(job.scheduled_at))}`.trim();
  const rsv = asArray<any>(order.reservations).sort((a, b) => String(b.reserved_date ?? "").localeCompare(String(a.reserved_date ?? "")))[0];
  if (rsv?.reserved_date) return `${String(rsv.reserved_date).slice(0, 10)} ${slotLabel(rsv.time_slot)}`.trim();
  return "";
}

function addressText(order: any): string {
  const home = one(order.homes);
  const cust = one(order.customers);
  const full = home?.address_full ?? cust?.address_full ?? "";
  const apt = home?.address_apt ?? cust?.address_apt ?? "";
  return [full, apt].filter(Boolean).join(" ") || "주소 미입력";
}

function stageOf(status: string): { stage: Stage; text: string } {
  if (["completed", "done"].includes(status)) return { stage: "s-d", text: "완료" };
  if (["cancel_requested", "canceled", "cancelled", "issue", "warranty"].includes(status)) return { stage: "s-c", text: status === "cancel_requested" ? "취소 요청" : status === "warranty" ? "A/S" : "취소" };
  if (["scheduled", "in_progress"].includes(status)) return { stage: "s-v", text: status === "in_progress" ? "진행 중" : "방문 예정" };
  if (["paid", "product_paid"].includes(status)) return { stage: "s-v", text: "방문 확정 대기" };
  if (["payment_pending", "pending_product_payment"].includes(status)) return { stage: "s-p", text: "입금 확인" };
  return { stage: "s-q", text: "견적" };
}

function actionOf(order: any, status: string): Pick<OrderCard, "nextAction" | "buttonLabel" | "buttonTone" | "buttonAction" | "cancellationId"> {
  if (["cancel_requested"].includes(status)) {
    const c = asArray<any>(order.cancellations).find((x) => x.status === "requested" || x.status === "pending") ?? asArray<any>(order.cancellations)[0];
    return { nextAction: "취소 승인/거절", buttonLabel: "취소 처리", buttonTone: "b-dan", buttonAction: "cancel", cancellationId: c?.id ?? null };
  }
  if (["payment_pending", "pending_product_payment"].includes(status)) {
    return { nextAction: "입금 들어왔으면 확인", buttonLabel: "입금 확인 ✓", buttonTone: "b-warn", buttonAction: "confirm-payment", cancellationId: null };
  }
  if (["paid", "product_paid"].includes(status)) {
    return { nextAction: "방문 일정 확인 후 확정", buttonLabel: "방문 확정 →", buttonTone: "b-pri", buttonAction: "confirm-reservation", cancellationId: null };
  }
  if (["quoted"].includes(status)) {
    return { nextAction: "견적 확인 · 입금 안내", buttonLabel: "상세 →", buttonTone: "b-ghost", buttonAction: "detail", cancellationId: null };
  }
  return { nextAction: "", buttonLabel: "상세 →", buttonTone: "b-ghost", buttonAction: "detail", cancellationId: null };
}

async function toCard(supabase: any, order: any): Promise<OrderCard> {
  const status = String(order.status ?? "");
  const { stage, text } = stageOf(status);
  const doc = buildQuoteDocumentInputFromOrderStatus(order);
  const rows = doc.rows ?? [];
  const cust = one(order.customers);
  const productSummary = rows.length
    ? `${rows[0].productName}${rows.length > 1 ? ` 외 ${rows.length - 1}종` : ""} · ${rows.reduce((s: number, r: any) => s + Number(r.qty ?? 1), 0)}개`
    : formatServiceName(order.service_type_code);
  const sched = scheduleText(order);
  const payText = stage === "s-p" ? "입금 대기 (계좌이체)" : stage === "s-v" ? (sched ? `결제완료 · ${sched}` : "결제완료") : stage === "s-c" ? "취소 요청" : stage === "s-d" ? "완료" : "견적 발송됨";

  // 사진 서명 (최대 3장)
  let photos: string[] = [];
  const raw = asArray<string>(order.inquiry_photos).slice(0, 3);
  if (raw.length && supabase) {
    photos = (
      await Promise.all(
        raw.map(async (p) => {
          if (/^https?:\/\//i.test(p)) return p;
          const { data } = await supabase.storage.from(ORDER_PHOTOS_BUCKET).createSignedUrl(p, ORDER_PHOTO_VIEW_EXPIRES_IN);
          return data?.signedUrl ?? null;
        })
      )
    ).filter((u): u is string => Boolean(u));
  }

  return {
    id: String(order.id),
    orderNumber: order.order_number ?? null,
    name: cust?.name ?? "성함 없음",
    phone: cust?.phone ?? "",
    address: addressText(order),
    stage,
    stageText: text,
    rawStatus: status,
    productSummary,
    amountText: won(Number(doc.finalTotal ?? order.total_amount ?? 0)),
    payText,
    scheduleText: sched,
    ...actionOf(order, status),
    photos,
    doc
  };
}

export async function getOrdersOverview(): Promise<OrdersOverview> {
  if (!hasSupabaseEnv()) return SAMPLE_OVERVIEW;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("orders")
    .select(RELATIONS)
    .is("deleted_at", null)
    .or("is_test.is.null,is_test.eq.false")
    .neq("status", "inquiry")
    .order("created_at", { ascending: false })
    .limit(60);

  const orders = data ?? [];
  const pipe = { quote: 0, payment: 0, visit: 0, done: 0, issue: 0 };
  for (const o of orders) {
    const s = String(o.status ?? "");
    if (s === "quoted") pipe.quote++;
    else if (["payment_pending", "pending_product_payment"].includes(s)) pipe.payment++;
    else if (["paid", "product_paid", "scheduled", "in_progress"].includes(s)) pipe.visit++;
    else if (["completed", "done"].includes(s)) pipe.done++;
    else if (["cancel_requested", "canceled", "cancelled", "issue", "warranty"].includes(s)) pipe.issue++;
  }

  // 화면에 실제로 보이는 카드만 무겁게 처리(견적서 계산 + 사진 서명) — 속도 개선
  const todoOrders: any[] = [];
  const activeOrders: any[] = [];
  for (const o of orders) {
    const status = String(o.status ?? "");
    const { stage } = stageOf(status);
    const act = actionOf(o, status);
    if (["s-q", "s-p", "s-c"].includes(stage) || (stage === "s-v" && act.buttonAction === "confirm-reservation")) todoOrders.push(o);
    else if (stage === "s-v" && act.buttonAction === "detail") activeOrders.push(o);
  }
  const [todo, active] = await Promise.all([
    Promise.all(todoOrders.map((o) => toCard(supabase, o))),
    Promise.all(activeOrders.map((o) => toCard(supabase, o)))
  ]);

  return { hasDb: true, pipe, todo, active };
}

/* ===== 로컬/미리보기 샘플 ===== */
const sampleDoc = (name: string, product: string, sku: string, price: number, labor: number, total: number): QuoteDocumentInput => ({
  orderNumber: null,
  customerName: name,
  serviceName: "제품 교체",
  rows: [{ id: "1", image: null, productName: product, sku, serviceCode: "", categoryLabel: "", qty: 1, price, labor, shipping: 10000, finalPrice: price + labor + 10000 } as any],
  address: "",
  visitText: "방문일 조율 중",
  productTotal: price,
  laborTotal: labor,
  shippingTotal: 10000,
  finalTotal: total,
  transferAmount: price + 10000,
  onsiteAmount: labor,
  productCatalogMode: true
});

const SAMPLE_OVERVIEW: OrdersOverview = {
  hasDb: false,
  pipe: { quote: 2, payment: 2, visit: 3, done: 12, issue: 1 },
  todo: [
    { id: "o1", orderNumber: "BO-20260709-3JWZ7A", name: "김민서", phone: "010-3921-7744", address: "경기 성남시 분당구", stage: "s-p", stageText: "입금 확인", rawStatus: "payment_pending", productSummary: "세면대 반다리 CL-370 · 1개", amountText: "259,000원", payText: "입금 대기 (계좌이체)", scheduleText: "", nextAction: "입금 들어왔으면 확인", buttonLabel: "입금 확인 ✓", buttonTone: "b-warn", buttonAction: "confirm-payment", cancellationId: null, photos: [], doc: sampleDoc("김민서", "대림바스 반다리 CL-370", "CL-370", 141000, 88000, 259000) },
    { id: "o2", orderNumber: "BO-20260708-1PWW2X", name: "이준호", phone: "010-5510-2093", address: "경기 용인시 수지구", stage: "s-v", stageText: "방문 확정 대기", rawStatus: "paid", productSummary: "양변기 CC-724 투피스 · 1개", amountText: "356,000원", payText: "결제완료 · 희망 7/11 오전", scheduleText: "2026-07-11 오전", nextAction: "방문 일정 확인 후 확정", buttonLabel: "방문 확정 →", buttonTone: "b-pri", buttonAction: "confirm-reservation", cancellationId: null, photos: [], doc: sampleDoc("이준호", "대림바스 CC-724 투피스", "CC-724", 246000, 100000, 356000) },
    { id: "o3", orderNumber: "BO-20260708-6HN0LK", name: "한도윤", phone: "010-8842-1177", address: "경기 화성시 동탄", stage: "s-c", stageText: "취소 요청", rawStatus: "cancel_requested", productSummary: "세면수전 크롬 · 1개", amountText: "102,000원", payText: "취소 요청", scheduleText: "", nextAction: "취소 승인/거절", buttonLabel: "취소 처리", buttonTone: "b-dan", buttonAction: "cancel", cancellationId: "c1", photos: [], doc: sampleDoc("한도윤", "대림바스 세면수전 크롬", "DL-L2210", 58000, 44000, 102000) }
  ],
  active: [
    { id: "o4", orderNumber: "BO-20260707-J1PWW2", name: "최지아", phone: "010-4349-4982", address: "경기 의왕시 신안", stage: "s-v", stageText: "방문 예정", rawStatus: "scheduled", productSummary: "샤워수전 BFB-720 · 1개", amountText: "264,000원", payText: "결제완료 · 오늘 오후 2시 · 기사 정현우", scheduleText: "2026-07-09 오후", nextAction: "오늘 방문", buttonLabel: "상세 →", buttonTone: "b-ghost", buttonAction: "detail", cancellationId: null, photos: [], doc: sampleDoc("최지아", "대림바스 레인샤워 BFB-720", "BFB-720", 154000, 100000, 264000) }
  ]
};
