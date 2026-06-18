import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { sendOrderQuoteAlimtalk } from "@/lib/admin-quote-alimtalk";
import { hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  if (!hasSupabaseEnv()) {
    return fail("local_mode", "로컬 확인 모드에서는 카카오 알림톡을 발송하지 않습니다.", 409, { localMode: true });
  }

  const { id } = await context.params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return fail("bad_request", "주문 ID를 다시 확인해주세요.", 400);

  try {
    const result = await sendOrderQuoteAlimtalk(parsedId.data);
    if (!result.ok) {
      return fail(result.code ?? "alimtalk_failed", result.message ?? "카카오 알림톡 발송에 실패했습니다.", result.status ?? 500, result.providerResponse);
    }

    return ok({ sent: true, ...result });
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "카카오 알림톡 발송에 실패했습니다.", 500);
  }
}
