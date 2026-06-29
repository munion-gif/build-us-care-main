import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { sendAdminOrderNoticeAlimtalk } from "@/lib/admin-order-notice-alimtalk";
import { readJson, validationError } from "@/lib/errors";
import { hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  memo: z.string().trim().min(1, "안내 메모를 입력해주세요.").max(1000, "안내 메모는 1000자 이내로 입력해주세요.")
});

export async function POST(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  if (!hasSupabaseEnv()) {
    return fail("local_mode", "로컬 확인 모드에서는 카카오 알림톡을 발송하지 않습니다.", 409, { localMode: true });
  }

  const { id } = await context.params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return fail("bad_request", "주문 ID를 다시 확인해주세요.", 400);

  const body = await readJson(request);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error, "Invalid order notice alimtalk payload.");

  try {
    const result = await sendAdminOrderNoticeAlimtalk(parsedId.data, parsed.data.memo);
    if (!result.ok) {
      return fail(result.code ?? "alimtalk_failed", result.message ?? "주문 안내 알림톡 발송에 실패했습니다.", result.status ?? 500, result.providerResponse);
    }

    return ok({ sent: true, ...result });
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "주문 안내 알림톡 발송에 실패했습니다.", 500);
  }
}
