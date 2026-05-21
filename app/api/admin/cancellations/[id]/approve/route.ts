import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { cancelTossPayment } from "@/lib/toss";
import { uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

function asArray<T = any>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function latestDonePayment(order: any) {
  return asArray(order?.payments)
    .filter((payment: any) => payment.status === "done")
    .sort((a: any, b: any) => String(b.paid_at ?? b.approved_at ?? b.created_at ?? "").localeCompare(String(a.paid_at ?? a.approved_at ?? a.created_at ?? "")))[0] ?? null;
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
    .select("*, orders(*, payments(*), jobs(*))")
    .eq("id", cancellationId.data)
    .maybeSingle();

  if (error) return fail("internal_error", error.message, 500);
  if (!cancellation) return fail("not_found", "Cancellation request not found.", 404);
  if (cancellation.status === "completed") return ok({ cancellation, idempotent: true });
  if (cancellation.status !== "pending") return fail("CANCELLATION_NOT_PENDING", "처리 대기 중인 취소 요청만 승인할 수 있습니다.", 409);

  const order = cancellation.orders;
  const payment = latestDonePayment(order);
  const paymentKey = payment?.payment_key ?? order?.payment_key;
  if (Number(cancellation.refund_amount ?? 0) > 0 && !paymentKey) {
    return fail("PAYMENT_KEY_REQUIRED", "환불을 처리할 결제키를 찾지 못했습니다.", 409);
  }

  let tossCancel: unknown = null;
  if (Number(cancellation.refund_amount ?? 0) > 0 && paymentKey) {
    tossCancel = await cancelTossPayment({
      paymentKey,
      cancelReason: body?.reason ?? cancellation.reason ?? "관리자 취소 승인",
      refundAmount: Number(cancellation.refund_rate) < 1 ? Number(cancellation.refund_amount) : undefined
    });
  }

  const processedAt = new Date().toISOString();
  const [{ data: updatedCancellation, error: updateError }, jobsResult] = await Promise.all([
    supabase
      .from("cancellations")
      .update({
        status: "completed",
        processed_at: processedAt,
        toss_cancel_key: String((tossCancel as any)?.transactionKey ?? (tossCancel as any)?.paymentKey ?? paymentKey ?? ""),
        note: body?.note ?? null
      })
      .eq("id", cancellation.id)
      .select("*")
      .single(),
    supabase.from("jobs").update({ status: "cancelled" }).eq("order_id", order.id).neq("status", "cancelled")
  ]);

  if (updateError) return fail("internal_error", updateError.message, 500);
  if (jobsResult.error) return fail("internal_error", jobsResult.error.message, 500);

  const { error: orderError } = await supabase.from("orders").update({ status: "canceled" }).eq("id", order.id);
  if (orderError) return fail("internal_error", orderError.message, 500);

  return ok({ cancellation: updatedCancellation, synced_order_status: "canceled" });
}
