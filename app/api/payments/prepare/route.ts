import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { EVENT_TYPES } from "@/lib/event-types";
import { readJson, validationError } from "@/lib/errors";
import {
  buildPaymentOrderName,
  calculatePreparedPaymentAmounts,
  createPaymentOrderId
} from "@/lib/payment-amounts";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { paymentPrepareSchema } from "@/lib/validation";

function isSchemaCompatibilityError(error: any) {
  const message = String(error?.message ?? "");
  return error?.code === "PGRST204" || error?.code === "42703" || error?.code === "22P02" || message.includes("Could not find") || message.includes("column");
}

async function findOrderId(params: { orderId?: string; quoteId?: string; reservationId?: string }) {
  const supabase = getSupabaseAdmin();
  if (params.orderId) return params.orderId;

  if (params.quoteId) {
    const { data, error } = await supabase.from("quotes").select("order_id").eq("id", params.quoteId).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.order_id ?? null;
  }

  if (params.reservationId) {
    const { data, error } = await supabase.from("reservations").select("order_id").eq("id", params.reservationId).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.order_id ?? null;
  }

  return null;
}

export async function POST(request: Request) {
  const requestId = createRequestId();

  if (!hasSupabaseEnv()) {
    logOperation({
      requestId,
      endpoint: "/api/payments/prepare",
      method: "POST",
      success: false,
      errorCode: "SUPABASE_NOT_CONFIGURED"
    });
    return fail("supabase_not_configured", "Supabase is required to prepare payments.", 500);
  }

  const body = await readJson(request);
  const parsed = paymentPrepareSchema.safeParse(body);

  if (!parsed.success) {
    logOperation({
      requestId,
      endpoint: "/api/payments/prepare",
      method: "POST",
      success: false,
      errorCode: "VALIDATION_ERROR"
    });
    return validationError(parsed.error, "Invalid payment prepare request.");
  }

  const supabase = getSupabaseAdmin();
  let orderId: string | null;
  try {
    orderId = await findOrderId(parsed.data);
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Payment prepare lookup failed.", 500);
  }

  if (!orderId) {
    return fail("not_found", "Order not found.", 404);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .is("deleted_at", null)
    .single();

  if (orderError || !order) {
    logOperation({
      requestId,
      endpoint: "/api/payments/prepare",
      method: "POST",
      identifiers: { order_id: orderId },
      success: false,
      errorCode: "NOT_FOUND"
    });
    return fail("not_found", "Order not found.", 404);
  }

  if (order.is_test) {
    const authError = requireAdmin(request);
    if (authError) return fail("not_found", "Order not found.", 404);
  }

  const quoteQuery = supabase
    .from("quotes")
    .select("*")
    .eq("order_id", order.id)
    .not("accepted_at", "is", null)
    .order("version", { ascending: false })
    .limit(1);

  const { data: acceptedQuote, error: quoteError } = parsed.data.quoteId
    ? await supabase.from("quotes").select("*").eq("id", parsed.data.quoteId).eq("order_id", order.id).not("accepted_at", "is", null).maybeSingle()
    : await quoteQuery.maybeSingle();

  if (quoteError) {
    return fail("internal_error", quoteError.message, 500);
  }

  if (!acceptedQuote) {
    logOperation({
      requestId,
      endpoint: "/api/payments/prepare",
      method: "POST",
      identifiers: { order_id: order.id },
      success: false,
      errorCode: "QUOTE_REQUIRED"
    });
    return fail("QUOTE_REQUIRED", "Accepted quote is required before payment.", 400);
  }

  const amounts = calculatePreparedPaymentAmounts(acceptedQuote);
  if (amounts.onlinePaymentAmount <= 0) {
    return fail("BAD_REQUEST", "Payment amount must be greater than 0.", 400);
  }

  let providerOrderId = createPaymentOrderId();
  const orderName = buildPaymentOrderName(order, acceptedQuote);
  const now = new Date().toISOString();
  const quoteStatus = amounts.isProductSelectionQuote ? "pending_product_payment" : "payment_pending";
  const provider = parsed.data.provider;
  const isBankTransfer = provider === "bank_transfer";

  const paymentPayload = {
    order_id: order.id,
    quote_id: acceptedQuote.id,
    provider,
    provider_order_id: providerOrderId,
    method: isBankTransfer ? "transfer" : "unknown",
    order_name: orderName,
    amount: amounts.onlinePaymentAmount,
    status: isBankTransfer ? "pending" : "ready",
    provider_status: isBankTransfer ? "WAITING_DEPOSIT" : "READY",
    requested_at: now,
    product_amount: amounts.productAmount,
    service_fee_amount: amounts.serviceFeeAmount,
    total_amount: amounts.totalAmount,
    online_payment_amount: amounts.onlinePaymentAmount,
    onsite_payment_amount: amounts.onsitePaymentAmount,
    onsite_payment_status: amounts.onsitePaymentAmount > 0 ? "PENDING" : "DONE",
    quote_status: quoteStatus
  };

  let { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert(paymentPayload)
    .select("*")
    .single();

  if (paymentError) {
    if (isSchemaCompatibilityError(paymentError)) {
      providerOrderId = order.id;
      const fallback = await supabase
        .from("payments")
        .insert({
          order_id: order.id,
          quote_id: acceptedQuote.id,
          provider,
          method: isBankTransfer ? "transfer" : "unknown",
          order_name: orderName,
          amount: amounts.onlinePaymentAmount,
          status: isBankTransfer ? "pending" : "ready",
          provider_status: isBankTransfer ? "WAITING_DEPOSIT" : "READY",
          requested_at: now
        })
        .select("*")
        .single();

      payment = fallback.data;
      paymentError = fallback.error;
    }

    if (paymentError) {
      logOperation({
        requestId,
        endpoint: "/api/payments/prepare",
        method: "POST",
        identifiers: { order_id: order.id, quote_id: acceptedQuote.id },
        success: false,
        errorCode: "PAYMENT_PREPARE_FAILED"
      });
      return fail("internal_error", paymentError.message, 500);
    }
  }

  if (!payment) {
    return fail("internal_error", "Payment prepare failed.", 500);
  }

  const orderUpdate = await supabase
    .from("orders")
    .update({
      status: quoteStatus,
      total_amount: amounts.totalAmount,
      online_payment_amount: amounts.onlinePaymentAmount,
      onsite_payment_amount: amounts.onsitePaymentAmount,
      onsite_payment_status: amounts.onsitePaymentAmount > 0 ? "PENDING" : "DONE"
    })
    .eq("id", order.id);

  if (orderUpdate.error && isSchemaCompatibilityError(orderUpdate.error)) {
    await supabase
      .from("orders")
      .update({
        status: "payment_pending",
        total_amount: amounts.totalAmount
      })
      .eq("id", order.id);
  }

  if (!order.is_test) {
    await supabase.from("events").insert({
      event_type: EVENT_TYPES.PAYMENT_STARTED,
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
        provider_order_id: providerOrderId,
        provider,
        quote_id: acceptedQuote.id,
        product_amount: amounts.productAmount,
        service_fee_amount: amounts.serviceFeeAmount,
        total_amount: amounts.totalAmount
      }
    });
  }

  logOperation({
    requestId,
    endpoint: "/api/payments/prepare",
    method: "POST",
    identifiers: { order_id: order.id, quote_id: acceptedQuote.id, payment_id: payment.id },
    success: true
  });

  return ok({
    orderId: providerOrderId,
    internalOrderId: order.id,
    accessToken: order.access_token,
    paymentId: payment.id,
    provider,
    orderName,
    amount: amounts.onlinePaymentAmount,
    productAmount: amounts.productAmount,
    serviceFeeAmount: amounts.serviceFeeAmount,
    totalAmount: amounts.totalAmount,
    onsitePaymentAmount: amounts.onsitePaymentAmount
  });
}
