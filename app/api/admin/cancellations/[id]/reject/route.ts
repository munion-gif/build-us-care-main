import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

function asArray<T = any>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function restoredStatus(order: any) {
  const activeJob = asArray(order?.jobs).find((job: any) => job.status !== "cancelled" && job.scheduled_at && job.technician_id);
  return activeJob ? "scheduled" : "paid";
}

export async function POST(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { id } = await context.params;
  const cancellationId = uuidSchema.safeParse(id);
  if (!cancellationId.success) return fail("BAD_REQUEST", "Invalid cancellation id.", 400);

  const body = await readJson(request);
  const supabase = getSupabaseAdmin();
  const { data: cancellation, error } = await supabase
    .from("cancellations")
    .select("*, orders(*, jobs(*))")
    .eq("id", cancellationId.data)
    .maybeSingle();

  if (error) return fail("internal_error", error.message, 500);
  if (!cancellation) return fail("not_found", "Cancellation request not found.", 404);
  if (cancellation.status === "rejected") return ok({ cancellation, idempotent: true });
  if (cancellation.status !== "pending") return fail("CANCELLATION_NOT_PENDING", "처리 대기 중인 취소 요청만 반려할 수 있습니다.", 409);

  const nextStatus = restoredStatus(cancellation.orders);
  const processedAt = new Date().toISOString();
  const [{ data: updatedCancellation, error: updateError }, orderResult] = await Promise.all([
    supabase
      .from("cancellations")
      .update({
        status: "rejected",
        processed_at: processedAt,
        note: body?.note ?? "관리자 반려"
      })
      .eq("id", cancellation.id)
      .select("*")
      .single(),
    supabase.from("orders").update({ status: nextStatus }).eq("id", cancellation.order_id)
  ]);

  if (updateError) return fail("internal_error", updateError.message, 500);
  if (orderResult.error) return fail("internal_error", orderResult.error.message, 500);

  return ok({ cancellation: updatedCancellation, synced_order_status: nextStatus });
}
