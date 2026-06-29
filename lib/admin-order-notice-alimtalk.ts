import { sendOrderNoticeAlimtalk } from "@/lib/solapi-alimtalk";
import { getSupabaseAdmin } from "@/lib/supabase";

function asOne(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function customerPhone(order: any) {
  const customer = asOne(order?.customers);
  return customer?.phone ?? "";
}

export async function sendAdminOrderNoticeAlimtalk(orderId: string, memo: string) {
  const supabase = getSupabaseAdmin();
  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      access_token,
      customers(name,phone)
    `)
    .eq("id", orderId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order) {
    return { ok: false, status: 404, code: "not_found", message: "주문을 찾을 수 없습니다." };
  }
  if (!order.access_token) {
    return { ok: false, status: 409, code: "missing_access_token", message: "주문 현황 링크에 필요한 접근토큰이 없습니다." };
  }

  const noticeMemo = String(memo ?? "").trim();
  const result = await sendOrderNoticeAlimtalk({
    to: customerPhone(order),
    noticeMemo,
    orderId: order.id,
    accessToken: order.access_token
  });

  if (!result.ok) {
    return {
      ok: false,
      status: 502,
      code: "alimtalk_failed",
      message: result.error ?? "주문 안내 알림톡 발송에 실패했습니다.",
      providerResponse: result.providerResponse
    };
  }

  return {
    ok: true,
    status: 200,
    orderId: order.id,
    orderNumber: order.order_number,
    noticeMemo,
    providerResponse: result.providerResponse
  };
}
