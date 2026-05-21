import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { readJson, validationError } from "@/lib/errors";
import { cancelTossPayment } from "@/lib/toss";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { accessTokenSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

const cancelSchema = z.object({
  accessToken: accessTokenSchema.optional(),
  reason: z.string().max(500).optional()
});

function asArray<T = any>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function latestBy<T extends Record<string, any>>(rows: T[], key: string) {
  return [...rows].sort((a, b) => String(b[key] ?? b.created_at ?? "").localeCompare(String(a[key] ?? a.created_at ?? "")))[0] ?? null;
}

function scheduledAtFrom(order: any) {
  const job = latestBy(asArray(order.jobs).filter((row: any) => row.scheduled_at && row.status !== "cancelled"), "scheduled_at");
  if (job?.scheduled_at) return new Date(job.scheduled_at);
  const reservation = latestBy(asArray(order.reservations).filter((row: any) => row.status !== "cancelled"), "created_at");
  if (reservation?.reserved_date) {
    const hour = reservation.time_slot === "afternoon" ? "13:00:00" : "09:00:00";
    return new Date(`${reservation.reserved_date}T${hour}+09:00`);
  }
  return null;
}

function readPolicy(settings: Record<string, string>) {
  return {
    fullRefundHours: Number(settings.cancel_policy_full_refund_hours ?? 24),
    fullRefundDaysBefore: Number(settings.cancel_policy_full_refund_days_before ?? 3),
    partialRefundRate: Number(settings.cancel_policy_partial_refund_rate ?? 0.5),
    noRefundStatuses: String(settings.cancel_policy_no_refund_status ?? "in_progress,completed,done,canceled,cancelled,warranty").split(",")
  };
}

export async function POST(request: Request, context: Context) {
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { id } = await context.params;
  const orderId = uuidSchema.safeParse(id);
  if (!orderId.success) return validationError(orderId.error, "Invalid order id.");

  const parsed = cancelSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error, "Invalid cancel request.");

  const supabase = getSupabaseAdmin();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*, payments(*), jobs(*), reservations(*), cancellations(*), customers(phone)")
    .eq("id", orderId.data)
    .eq("access_token", parsed.data.accessToken ?? "")
    .maybeSingle();

  if (orderError) return fail("internal_error", orderError.message, 500);
  if (!order) return fail("forbidden", "주문 확인 링크가 올바르지 않습니다.", 403);

  const existingPending = asArray(order.cancellations).find((row: any) => row.status === "pending");
  if (existingPending) {
    return ok({
      cancelType: existingPending.cancel_type,
      refundRate: Number(existingPending.refund_rate),
      refundAmount: Number(existingPending.refund_amount),
      message: "이미 취소 요청이 접수됐습니다. 담당자가 확인 후 안내드립니다.",
      cancellation: existingPending,
      idempotent: true
    });
  }

  const { data: configRows, error: configError } = await supabase
    .from("app_configs")
    .select("key,value")
    .in("key", ["cancel_policy_full_refund_hours", "cancel_policy_full_refund_days_before", "cancel_policy_partial_refund_rate", "cancel_policy_no_refund_status"]);
  if (configError) return fail("internal_error", configError.message, 500);

  const policy = readPolicy(Object.fromEntries((configRows ?? []).map((row) => [row.key, row.value])));
  if (policy.noRefundStatuses.includes(order.status)) {
    return fail("CANCEL_NOT_ALLOWED", "시공이 시작된 주문은 취소할 수 없습니다. 고객센터로 문의해주세요.", 403);
  }

  const payment = latestBy(asArray(order.payments).filter((row: any) => row.status === "done"), "paid_at");
  if (!payment) return fail("PAYMENT_REQUIRED", "결제 완료 주문만 취소 요청할 수 있습니다.", 400);

  const now = new Date();
  const paidAt = new Date(payment.paid_at ?? payment.approved_at ?? payment.created_at ?? now);
  const scheduledAt = scheduledAtFrom(order);
  const hoursSincePaid = (now.getTime() - paidAt.getTime()) / (1000 * 60 * 60);
  const daysUntilVisit = scheduledAt ? (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) : null;

  let refundRate = 0;
  let cancelType: "auto" | "manual" = "manual";
  if (hoursSincePaid <= policy.fullRefundHours && (daysUntilVisit === null || daysUntilVisit >= policy.fullRefundDaysBefore)) {
    refundRate = 1;
    cancelType = "auto";
  } else if (daysUntilVisit !== null && daysUntilVisit >= 1) {
    refundRate = policy.partialRefundRate;
    cancelType = "manual";
  }

  const refundAmount = Math.round(Number(payment.amount ?? 0) * refundRate);
  const reason = parsed.data.reason?.trim() || "고객 요청";

  if (cancelType === "auto") {
    const paymentKey = payment.payment_key ?? order.payment_key;
    if (!paymentKey) return fail("PAYMENT_KEY_REQUIRED", "환불을 처리할 결제키를 찾지 못했습니다. 고객센터로 문의해주세요.", 409);

    const tossCancel = await cancelTossPayment({
      paymentKey,
      cancelReason: reason,
      refundAmount: refundRate < 1 ? refundAmount : undefined
    });

    const { data: cancellation, error: cancellationError } = await supabase
      .from("cancellations")
      .insert({
        order_id: order.id,
        reason,
        refund_rate: refundRate,
        refund_amount: refundAmount,
        cancel_type: cancelType,
        status: "completed",
        toss_cancel_key: String((tossCancel as any)?.transactionKey ?? (tossCancel as any)?.paymentKey ?? payment.payment_key ?? ""),
        processed_at: new Date().toISOString()
      })
      .select("*")
      .single();

    if (cancellationError) return fail("internal_error", cancellationError.message, 500);

    await Promise.all([
      supabase.from("orders").update({ status: "canceled" }).eq("id", order.id),
      supabase.from("jobs").update({ status: "cancelled" }).eq("order_id", order.id).neq("status", "cancelled")
    ]);

    return ok({
      cancelType,
      refundRate,
      refundAmount,
      message: "취소가 완료됐습니다. 환불은 카드사 기준 3~5영업일 내 처리됩니다.",
      cancellation
    });
  }

  const { data: cancellation, error: cancellationError } = await supabase
    .from("cancellations")
    .insert({
      order_id: order.id,
      reason,
      refund_rate: refundRate,
      refund_amount: refundAmount,
      cancel_type: cancelType,
      status: "pending"
    })
    .select("*")
    .single();

  if (cancellationError) return fail("internal_error", cancellationError.message, 500);

  await Promise.all([
    supabase.from("orders").update({ status: "cancel_requested" }).eq("id", order.id),
    supabase.from("notifications").insert({
      order_id: order.id,
      channel: "mock",
      template_code: "cancel_requested",
      recipient: order.customers?.phone ?? order.customer_id,
      send_status: "queued",
      payload: { cancellation_id: cancellation.id, refund_amount: refundAmount, refund_rate: refundRate }
    })
  ]);

  return ok({
    cancelType,
    refundRate,
    refundAmount,
    message: "취소 요청이 접수됐습니다. 1영업일 내 처리 후 안내드립니다.",
    cancellation
  });
}
