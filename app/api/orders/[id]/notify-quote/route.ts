import { fail, ok } from "@/lib/api-response";
import { sendOrderQuoteAlimtalk } from "@/lib/admin-quote-alimtalk";
import { readJson } from "@/lib/errors";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

// 예약 완료 화면의 "카카오톡으로 결과 알림 받기" — 고객 본인(접근토큰 보유)에게 견적서 알림톡 발송
export async function POST(request: Request, context: Context) {
  if (!hasSupabaseEnv()) {
    return fail("local_mode", "로컬 확인 모드에서는 카카오 알림톡을 발송하지 않습니다.", 409, { localMode: true });
  }

  const { id } = await context.params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return fail("bad_request", "주문 정보를 다시 확인해주세요.", 400);

  const body = await readJson(request).catch(() => ({}));
  const accessToken =
    typeof (body as any)?.accessToken === "string" && (body as any).accessToken.trim()
      ? String((body as any).accessToken).trim()
      : new URL(request.url).searchParams.get("accessToken")?.trim() ?? "";
  if (!accessToken) return fail("unauthorized", "접근 권한이 없습니다.", 401);

  // 남용 방지: 주문당 + IP당 발송 제한
  const ip = getClientIp(request.headers);
  const perOrder = checkRateLimit(`order-notify-quote:${parsedId.data}`, { limit: 3, windowMs: 10 * 60 * 1000 });
  const perIp = checkRateLimit(`order-notify-quote-ip:${ip}`, { limit: 10, windowMs: 10 * 60 * 1000 });
  if (!perOrder.allowed || !perIp.allowed) {
    return fail("too_many_requests", "알림톡을 이미 보냈어요. 잠시 후 다시 시도해주세요.", 429);
  }

  const { data: order, error } = await getSupabaseAdmin()
    .from("orders")
    .select("id, access_token, deleted_at")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (error) return fail("internal_error", error.message, 500);
  if (!order || order.deleted_at || !order.access_token || order.access_token !== accessToken) {
    return fail("unauthorized", "접근 권한이 없습니다.", 401);
  }

  try {
    const result = await sendOrderQuoteAlimtalk(order.id);
    if (!result.ok) {
      return fail(result.code ?? "alimtalk_failed", result.message ?? "카카오 알림톡 발송에 실패했습니다.", result.status ?? 500);
    }
    return ok({ sent: true });
  } catch (err) {
    return fail("internal_error", err instanceof Error ? err.message : "카카오 알림톡 발송에 실패했습니다.", 500);
  }
}
