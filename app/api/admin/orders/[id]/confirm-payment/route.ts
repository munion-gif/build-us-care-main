import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { EVENT_TYPES } from "@/lib/event-types";
import { readJson, validationError } from "@/lib/errors";
import { notifyPaymentCompleted } from "@/lib/notify-admin";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { calculatePreparedPaymentAmounts } from "@/lib/payment-amounts";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

function asOne(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function isSchemaCompatibilityError(error: any) {
  const message = String(error?.message ?? "");
  return error?.code === "PGRST204" || error?.code === "42703" || error?.code === "22P02" || message.includes("Could not find") || message.includes("column");
}

function nextPaidStatus(orderStatus: string, quote: any) {
  if (orderStatus === "pending_product_payment" || calculatePreparedPaymentAmounts(quote).isProductSelectionQuote) return "product_paid";
  return "paid";
}

function compatiblePaidStatus(status: string) {
  return status === "product_paid" ? "paid" : status;
}

async function latestBankTransferPayment(supabase: ReturnType<typeof getSupabaseAdmin>, orderId: string) {
  let { data, error } = await supabase
    .from("payments")
    .select("*, orders(*, customers(name)), quotes(*)")
    .eq("order_id", orderId)
    .eq("provider", "bank_transfer")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && isSchemaCompatibilityError(error)) {
    const fallback = await supabase
      .from("payments")
      .select("*, orders(*, customers(name)), quotes(*)")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error(error.message);
  return data;
}

export async function POST(request: Request, context: Context) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/orders/:id/confirm-payment", method: "POST", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }

  if (!hasSupabaseEnv()) {
    return fail("LOCAL_READ_ONLY", "로컬 확인 모드에서는 입금 확인을 처리하지 않습니다.", 409, { localMode: true });
  }

  const { id } = await context.params;
  const orderId = uuidSchema.safeParse(id);
  if (!orderId.success) {
    return validationError(orderId.error, "Invalid order id.");
  }

  await readJson(request).catch(() => ({}));

  const supabase = getSupabaseAdmin();
  let payment: any;
  try {
    payment = await latestBankTransferPayment(supabase, orderId.data);
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Payment lookup failed.", 500);
  }

  if (!payment) {
    logOperation({ requestId, endpoint: "/api/admin/orders/:id/confirm-payment", method: "POST", adminKeyId, identifiers: { order_id: orderId.data }, success: false, errorCode: "PAYMENT_NOT_FOUND" });
    return fail("not_found", "계좌이체 대기 결제 정보를 찾지 못했습니다.", 404);
  }

  const order = asOne(payment.orders);
  const quote = asOne(payment.quotes);
  if (!order || !quote) {
    return fail("QUOTE_REQUIRED", "입금 확인 전 주문과 수락된 견적 정보가 필요합니다.", 400);
  }
  if (payment.provider && payment.provider !== "bank_transfer") {
    return fail("BAD_REQUEST", "계좌이체 결제만 수동 입금 확인할 수 있습니다.", 400);
  }

  const amounts = calculatePreparedPaymentAmounts(quote);
  const nextStatus = nextPaidStatus(String(order.status ?? ""), quote);
  const nextQuoteStatus = nextStatus;
  const now = new Date().toISOString();
  const paymentKey = payment.payment_key ?? `bank_transfer:${payment.id}`;

  if (payment.status === "done" && ["paid", "product_paid", "scheduled", "in_progress", "completed", "done", "warranty"].includes(String(order.status))) {
    return ok({ payment, order, duplicate: true });
  }

  let { data: updatedPayment, error: paymentUpdateError } = await supabase
    .from("payments")
    .update({
      payment_key: paymentKey,
      method: "transfer",
      amount: amounts.onlinePaymentAmount,
      status: "done",
      provider_status: "DEPOSIT_CONFIRMED",
      approved_at: now,
      paid_at: now,
      product_amount: amounts.productAmount,
      service_fee_amount: amounts.serviceFeeAmount,
      total_amount: amounts.totalAmount,
      online_payment_amount: amounts.onlinePaymentAmount,
      onsite_payment_amount: amounts.onsitePaymentAmount,
      onsite_payment_status: amounts.onsitePaymentAmount > 0 ? "PENDING" : "DONE",
      quote_status: nextQuoteStatus
    })
    .eq("id", payment.id)
    .select("*")
    .single();

  if (paymentUpdateError && isSchemaCompatibilityError(paymentUpdateError)) {
    const fallback = await supabase
      .from("payments")
      .update({
        payment_key: paymentKey,
        method: "transfer",
        amount: amounts.onlinePaymentAmount,
        status: "done",
        provider_status: "DEPOSIT_CONFIRMED",
        approved_at: now,
        paid_at: now
      })
      .eq("id", payment.id)
      .select("*")
      .single();
    updatedPayment = fallback.data;
    paymentUpdateError = fallback.error;
  }

  if (paymentUpdateError || !updatedPayment) {
    return fail("internal_error", paymentUpdateError?.message ?? "Payment update failed.", 500);
  }

  const orderPatch = {
    status: nextStatus,
    payment_key: paymentKey,
    online_payment_amount: amounts.onlinePaymentAmount,
    onsite_payment_amount: amounts.onsitePaymentAmount,
    onsite_payment_status: amounts.onsitePaymentAmount > 0 ? "PENDING" : "DONE"
  };
  let { data: updatedOrder, error: orderUpdateError } = await supabase
    .from("orders")
    .update(orderPatch)
    .eq("id", orderId.data)
    .select("*")
    .single();

  if (orderUpdateError && isSchemaCompatibilityError(orderUpdateError)) {
    const fallback = await supabase
      .from("orders")
      .update({ status: compatiblePaidStatus(nextStatus), payment_key: paymentKey })
      .eq("id", orderId.data)
      .select("*")
      .single();
    updatedOrder = fallback.data;
    orderUpdateError = fallback.error;
  }

  if (orderUpdateError || !updatedOrder) {
    return fail("internal_error", orderUpdateError?.message ?? "Order update failed.", 500);
  }

  const { error: paymentEventError } = await supabase.from("payment_events").insert({
    payment_id: updatedPayment.id,
    event_type: "bank_transfer_confirmed",
    payload: { actor: "admin", admin_key_id: adminKeyId, confirmed_at: now },
    idempotency_key: `bank_transfer_confirmed:${updatedPayment.id}`
  });
  if (paymentEventError && paymentEventError.code !== "23505") {
    return fail("internal_error", paymentEventError.message, 500);
  }

  if (!updatedOrder.is_test) {
    await supabase.from("events").insert({
      event_type: EVENT_TYPES.PAYMENT_COMPLETED,
      order_id: updatedOrder.id,
      customer_id: updatedOrder.customer_id ?? null,
      session_id: updatedOrder.session_id ?? null,
      source: updatedOrder.source ?? updatedOrder.channel ?? null,
      campaign: updatedOrder.campaign ?? null,
      landing_path: updatedOrder.landing_path ?? null,
      device_type: updatedOrder.device_type ?? null,
      service_code: updatedOrder.service_type_code ?? null,
      region_code: updatedOrder.region_code ?? null,
      properties: {
        payment_id: updatedPayment.id,
        quote_id: quote.id,
        provider: "bank_transfer",
        amount: amounts.onlinePaymentAmount,
        product_amount: amounts.productAmount,
        service_fee_amount: amounts.serviceFeeAmount,
        total_amount: amounts.totalAmount,
        confirmed_by: "admin"
      }
    });

    void notifyPaymentCompleted({
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.order_number,
      customerName: asOne(order.customers)?.name ?? "고객",
      amount: amounts.onlinePaymentAmount
    });
  }

  logOperation({ requestId, endpoint: "/api/admin/orders/:id/confirm-payment", method: "POST", adminKeyId, identifiers: { order_id: orderId.data, payment_id: updatedPayment.id }, success: true });
  return ok({ payment: updatedPayment, order: updatedOrder });
}
