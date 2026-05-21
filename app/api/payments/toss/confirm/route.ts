import { fail, ok } from "@/lib/api-response";
import { EVENT_TYPES } from "@/lib/event-types";
import { readJson, validationError } from "@/lib/errors";
import { notifyPaymentCompleted } from "@/lib/notify-admin";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { confirmTossPayment } from "@/lib/toss";
import { tossConfirmSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const requestId = createRequestId();

  if (!hasSupabaseEnv()) {
    logOperation({
      requestId,
      endpoint: "/api/payments/toss/confirm",
      method: "POST",
      success: false,
      errorCode: "SUPABASE_NOT_CONFIGURED"
    });
    return fail("supabase_not_configured", "Supabase is required to confirm payments.", 500);
  }

  const body = await readJson(request);
  const parsed = tossConfirmSchema.safeParse(body);

  if (!parsed.success) {
    logOperation({
      requestId,
      endpoint: "/api/payments/toss/confirm",
      method: "POST",
      success: false,
      errorCode: "VALIDATION_ERROR"
    });
    return validationError(parsed.error, "Invalid Toss confirm request.");
  }

  const supabase = getSupabaseAdmin();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*, customers(name)")
    .eq("id", parsed.data.orderId)
    .single();

  if (orderError || !order) {
    logOperation({
      requestId,
      endpoint: "/api/payments/toss/confirm",
      method: "POST",
      identifiers: { order_id: parsed.data.orderId },
      success: false,
      errorCode: "NOT_FOUND"
    });
    return fail("not_found", "Order not found.", 404);
  }

  const { data: acceptedQuote, error: quoteError } = await supabase
    .from("quotes")
    .select("*")
    .eq("order_id", order.id)
    .not("accepted_at", "is", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (quoteError) {
    return fail("internal_error", quoteError.message, 500);
  }

  if (!acceptedQuote) {
    logOperation({
      requestId,
      endpoint: "/api/payments/toss/confirm",
      method: "POST",
      identifiers: { order_id: order.id },
      success: false,
      errorCode: "QUOTE_REQUIRED"
    });
    return fail("QUOTE_REQUIRED", "Accepted quote is required before payment.", 400);
  }

  if (acceptedQuote.total_final !== parsed.data.amount) {
    logOperation({
      requestId,
      endpoint: "/api/payments/toss/confirm",
      method: "POST",
      identifiers: { order_id: order.id, quote_id: acceptedQuote.id, expected_amount: acceptedQuote.total_final, received_amount: parsed.data.amount },
      success: false,
      errorCode: "PAYMENT_AMOUNT_MISMATCH"
    });
    return fail("AMOUNT_MISMATCH", "Payment amount does not match accepted quote total.", 400, {
      expected: acceptedQuote.total_final,
      received: parsed.data.amount
    });
  }

  const { data: existingPayment, error: existingError } = await supabase
    .from("payments")
    .select("*")
    .eq("payment_key", parsed.data.paymentKey)
    .maybeSingle();

  if (existingError) {
    logOperation({
      requestId,
      endpoint: "/api/payments/toss/confirm",
      method: "POST",
      identifiers: { order_id: order.id },
      success: false,
      errorCode: "PAYMENT_LOOKUP_FAILED"
    });
    return fail("internal_error", existingError.message, 500);
  }

  if (existingPayment) {
    if (existingPayment.order_id !== order.id || existingPayment.quote_id !== acceptedQuote.id || existingPayment.amount !== parsed.data.amount) {
      logOperation({
        requestId,
        endpoint: "/api/payments/toss/confirm",
        method: "POST",
        identifiers: { order_id: order.id, payment_id: existingPayment.id },
        success: false,
        errorCode: "PAYMENT_KEY_CONFLICT"
      });
      return fail("conflict", "Payment key was already used for a different order or amount.", 409);
    }

    if (existingPayment.status === "done") {
      logOperation({
        requestId,
        endpoint: "/api/payments/toss/confirm",
        method: "POST",
        identifiers: { order_id: order.id, payment_id: existingPayment.id },
        success: true
      });
      return ok({ payment: existingPayment, duplicate: true });
    }
  }

  const toss = await confirmTossPayment({
    paymentKey: parsed.data.paymentKey,
    orderId: parsed.data.orderId,
    amount: parsed.data.amount
  });

  const paymentStatus = toss.status === "DONE" ? "done" : "failed";
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .upsert(
      {
        id: existingPayment?.id,
        order_id: order.id,
        quote_id: acceptedQuote.id,
        provider: "toss",
        method: typeof toss.raw.method === "string" ? toss.raw.method : "unknown",
        payment_key: parsed.data.paymentKey,
        order_name: parsed.data.orderName ?? order.order_number,
        amount: parsed.data.amount,
        status: paymentStatus,
        provider_status: toss.status,
        requested_at: new Date().toISOString(),
        approved_at: toss.approvedAt,
        paid_at: paymentStatus === "done" ? toss.approvedAt ?? new Date().toISOString() : null
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (paymentError) {
    logOperation({
      requestId,
      endpoint: "/api/payments/toss/confirm",
      method: "POST",
      identifiers: { order_id: order.id },
      success: false,
      errorCode: "PAYMENT_RECORD_FAILED"
    });
    return fail("internal_error", paymentError.message, 500);
  }

  const { error: eventError } = await supabase.from("payment_events").insert({
    payment_id: payment.id,
    event_type: "confirm",
    payload: toss.raw,
    idempotency_key: `confirm:${parsed.data.paymentKey}`
  });

  if (eventError && eventError.code !== "23505") {
    logOperation({
      requestId,
      endpoint: "/api/payments/toss/confirm",
      method: "POST",
      identifiers: { order_id: order.id, payment_id: payment.id },
      success: false,
      errorCode: "PAYMENT_EVENT_RECORD_FAILED"
    });
    return fail("internal_error", eventError.message, 500);
  }

  if (paymentStatus === "done") {
    await supabase.from("orders").update({ status: "paid", payment_key: parsed.data.paymentKey }).eq("id", order.id);
    await supabase.from("events").insert({
      event_type: EVENT_TYPES.PAYMENT_COMPLETED,
      order_id: order.id,
      customer_id: order.customer_id ?? null,
      session_id: order.session_id ?? null,
      source: order.source ?? order.channel ?? null,
      campaign: order.campaign ?? null,
      landing_path: order.landing_path ?? null,
      device_type: order.device_type ?? null,
      service_code: order.service_type_code ?? null,
      region_code: order.region_code ?? null,
      properties: {
        payment_id: payment.id,
        quote_id: acceptedQuote.id,
        amount: parsed.data.amount,
        provider_status: toss.status
      }
    });
    void notifyPaymentCompleted({
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customers?.name ?? "고객",
      amount: parsed.data.amount
    });
  }

  if (paymentStatus !== "done") {
    logOperation({
      requestId,
      endpoint: "/api/payments/toss/confirm",
      method: "POST",
      identifiers: { order_id: order.id, payment_id: payment.id },
      success: false,
      errorCode: "PAYMENT_NOT_DONE"
    });
    return fail("PAYMENT_ERROR", "Toss payment was not approved.", 400, toss.raw);
  }

  logOperation({
    requestId,
    endpoint: "/api/payments/toss/confirm",
    method: "POST",
    identifiers: { order_id: order.id, payment_id: payment.id },
    success: true
  });

  return ok({ payment, toss });
}
