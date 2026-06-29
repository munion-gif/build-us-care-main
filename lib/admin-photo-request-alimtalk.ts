import { sendPhotoRequestAlimtalk } from "@/lib/solapi-alimtalk";
import { getSupabaseAdmin } from "@/lib/supabase";

function asOne(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function customerPhone(diagnosis: any) {
  const order = asOne(diagnosis?.orders);
  const customer = asOne(order?.customers);
  return diagnosis?.customer_phone ?? diagnosis?.raw_response?.customer?.phone ?? customer?.phone ?? "";
}

function customerName(diagnosis: any) {
  const order = asOne(diagnosis?.orders);
  const customer = asOne(order?.customers);
  return diagnosis?.customer_name ?? diagnosis?.raw_response?.customer?.name ?? customer?.name ?? "고객";
}

function defaultMemo(name: string) {
  return `안녕하세요! 빌드어스입니다.\n\n${name}님께서 등록해 주신 사진만으로는 정확한 확인이 어려워 추가 사진이 필요합니다.\n전체 사진, 문제 부위 근접 사진, 주변 환경 사진을 다시 한번 부탁드립니다.\n\n감사합니다.`;
}

export async function sendDiagnosisPhotoRequestAlimtalk(diagnosisId: string, memo?: string) {
  const supabase = getSupabaseAdmin();
  const { data: diagnosis, error } = await supabase
    .from("diagnoses")
    .select(`
      id,
      order_id,
      customer_name,
      customer_phone,
      reason,
      details,
      raw_response,
      orders(
        id,
        order_number,
        access_token,
        customers(name,phone)
      )
    `)
    .eq("id", diagnosisId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!diagnosis) {
    return { ok: false, status: 404, code: "not_found", message: "사진확인 접수를 찾을 수 없습니다." };
  }

  const order = asOne(diagnosis.orders);
  if (!order?.id || !order?.access_token) {
    return { ok: false, status: 409, code: "missing_access_token", message: "추가 사진 등록 링크에 필요한 주문ID 또는 접근토큰이 없습니다." };
  }

  const name = customerName(diagnosis);
  const consultationMemo = String(memo ?? diagnosis.reason ?? "").trim() || defaultMemo(name);
  const result = await sendPhotoRequestAlimtalk({
    to: customerPhone(diagnosis),
    consultationMemo,
    orderId: order.id,
    accessToken: order.access_token
  });

  if (!result.ok) {
    return {
      ok: false,
      status: 502,
      code: "alimtalk_failed",
      message: result.error ?? "추가 사진 요청 알림톡 발송에 실패했습니다.",
      providerResponse: result.providerResponse
    };
  }

  await supabase
    .from("diagnoses")
    .update({
      reason: consultationMemo,
      result_message: consultationMemo,
      reviewed_by: "admin",
      reviewed_at: new Date().toISOString()
    })
    .eq("id", diagnosisId);

  return {
    ok: true,
    status: 200,
    diagnosisId,
    orderId: order.id,
    orderNumber: order.order_number,
    consultationMemo,
    providerResponse: result.providerResponse
  };
}
