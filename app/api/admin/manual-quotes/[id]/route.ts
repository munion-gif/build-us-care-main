import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

async function readManualQuoteId(context: Context) {
  const { id } = await context.params;
  return uuidSchema.safeParse(id);
}

export async function DELETE(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("LOCAL_READ_ONLY", "로컬 확인 모드에서는 수동 견적을 삭제하지 않습니다.", 409, { localMode: true });

  const quoteId = await readManualQuoteId(context);
  if (!quoteId.success) return fail("bad_request", "견적서 ID를 다시 확인해주세요.", 400);

  const supabase = getSupabaseAdmin();
  const { data: quote, error: readError } = await supabase
    .from("manual_quotes")
    .select("id,quote_number,converted_order_id")
    .eq("id", quoteId.data)
    .maybeSingle();

  if (readError) return fail("internal_error", readError.message, 500);
  if (!quote) return fail("not_found", "삭제할 견적서를 찾을 수 없습니다.", 404);

  const { error: deleteError } = await supabase.from("manual_quotes").delete().eq("id", quote.id);
  if (deleteError) return fail("internal_error", deleteError.message, 500);

  return ok({
    deleted: true,
    manualQuoteId: quote.id,
    quoteNumber: quote.quote_number,
    convertedOrderId: quote.converted_order_id
  });
}
