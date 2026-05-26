import { fail, ok } from "@/lib/api-response";
import { EVENT_TYPES } from "@/lib/event-types";
import { readJson, validationError } from "@/lib/errors";
import { notifyPaymentCompleted } from "@/lib/notify-admin";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { calculatePreparedPaymentAmounts } from "@/lib/payment-amounts";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { confirmTossPayment } from "@/lib/toss";
import { paymentConfirmSchema } from "@/lib/validation";

function receiptUrl(raw: Record<string, unknown>) {
  const receipt = raw.receipt;
  if (receipt && typeof receipt === "object" && "url" in receipt && typeof receipt.url === "string") {
    return receipt.url;
  }
  return null;
}

function paymentMethod(raw: Record<string, unknown>) {
  return typeof raw.method === "string" ? raw.method : "unknown";
}

function isSchemaCompatibilityError(error: any) {
  const message = String(error?.message ?? "");
  return error?.code === "PGRST204" || error?.code === "42703" || error?.code === "22P02" || message.includes("Could not find") || message.includes("column");
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function confirmPreparedPayment(input: { paymentKey: string; orderId: string; amount: number }, requestId: string) {
  if (!hasSupabaseEnv()) {
    logOperation({
      requestId,
      endpoint: "/api/payments/confirm",
      method: "POST",
      success: false,
      errorCode: "SUPABASE_NOT_CONFIGURED"
    });
    return fail("supabase_not_configured", "Supabase is required to confirm payments.", 500);
  }

  const supabase = getSupabaseAdmin();
  let { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("*, orders(*, customers(name)), quotes(*)")
    .eq("provider_order_id", input.orderId)
    .maybeSingle();

  if (paymentError && isSchemaCompatibilityError(paymentError) && looksLikeUuid(input.orderId)) {
    const fallback = await supabase
      .from("payments")
      .select("*, orders(*, customers(name)), quotes(*)")
      .eq("order_id", input.orderId)
      .eq("amount", input.amount)
      .in("status", ["ready", "pending", "done"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    payment = fallback.data;
    paymentError = fallback.error;
  }

  if (paymentError) {
    return fail("internal_error", paymentError.message, 500);
  }

  if (!payment && looksLikeUuid(input.orderId)) {
    const fallback = await supabase
      .from("payments")
      .select("*, orders(*, customers(name)), quotes(*)")
      .eq("order_id", input.orderId)
      .eq("amount", input.amount)
      .in("status", ["ready", "pending", "done"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fallback.error) return fail("internal_error", fallback.error.message, 500);
    payment = fallback.data;
  }

  if (!payment) {
    logOperation({
      requestId,
      endpoint: "/api/payments/confirm",
      method: "POST",
      identifiers: { provider_order_id: input.orderId },
      success: false,
      errorCode: "PAYMENT_NOT_FOUND"
    });
    return fail("not_found", "Prepared payment not found.", 404);
  }

  const order = payment.orders;
  const quote = payment.quotes;
  if (!order || !quote) {
    return fail("QUOTE_REQUIRED", "Order and accepted quote are required before payment.", 400);
  }

  const amounts = calculatePreparedPaymentAmounts(quote);
  const storedProductAmount = Number(payment.product_amount ?? payment.amount ?? 0);

  if (amounts.productAmount !== storedProductAmount || amounts.productAmount !== input.amount) {
    logOperation({
      requestId,
      endpoint: "/api/payments/confirm",
      method: "POST",
      identifiers: {
        order_id: payment.order_id,
        payment_id: payment.id,
        expected_product_amount: amounts.productAmount,
        stored_product_amount: storedProductAmount,
        received_amount: input.amount
      },
      success: false,
      errorCode: "PAYMENT_AMOUNT_MISMATCH"
    });
    return fail("AMOUNT_MISMATCH", "Payment amount does not match selected product total.", 400, {
      expected: amounts.productAmount,
      received: input.amount
    });
  }

  const { data: paymentKeyOwner, error: paymentKeyError } = await supabase
    .from("payments")
    .select("id,order_id,quote_id,amount,status")
    .eq("payment_key", input.paymentKey)
    .maybeSingle();

  if (paymentKeyError) {
    return fail("internal_error", paymentKeyError.message, 500);
  }

  if (paymentKeyOwner && paymentKeyOwner.id !== payment.id) {
    logOperation({
      requestId,
      endpoint: "/api/payments/confirm",
      method: "POST",
      identifiers: { payment_id: payment.id, existing_payment_id: paymentKeyOwner.id },
      success: false,
      errorCode: "PAYMENT_KEY_CONFLICT"
    });
    return fail("conflict", "Payment key was already used for a different order.", 409);
  }

  if (payment.status === "done") {
    if (payment.payment_key && payment.payment_key !== input.paymentKey) {
      return fail("conflict", "Prepared payment was already approved with another payment key.", 409);
    }

    logOperation({
      requestId,
      endpoint: "/api/payments/confirm",
      method: "POST",
      identifiers: { order_id: payment.order_id, payment_id: payment.id },
      success: true
    });
    return ok({
      duplicate: true,
      payment,
      order,
      amount: amounts.productAmount,
      productAmount: amounts.productAmount,
      serviceFeeAmount: amounts.serviceFeeAmount,
      totalAmount: amounts.totalAmount,
      onsitePaymentAmount: amounts.onsitePaymentAmount
    });
  }

  await supabase
    .from("payments")
    .update({
      status: "pending",
      provider_status: "IN_PROGRESS",
      payment_key: input.paymentKey
    })
    .eq("id", payment.id);

  const toss = await confirmTossPayment({
    paymentKey: input.paymentKey,
    orderId: input.orderId,
    amount: input.amount
  });

  const paymentStatus = toss.status === "DONE" ? "done" : "failed";
  const nextOrderStatus = toss.status === "DONE"
    ? amounts.isProductSelectionQuote
      ? "product_paid"
      : "paid"
    : "payment_pending";
  const approvedAt = toss.approvedAt ?? (paymentStatus === "done" ? new Date().toISOString() : null);
  const nextQuoteStatus = toss.status === "DONE"
    ? amounts.isProductSelectionQuote
      ? "product_paid"
      : "paid"
    : amounts.isProductSelectionQuote
      ? "pending_product_payment"
      : "payment_pending";

  let { data: updatedPayment, error: updatePaymentError } = await supabase
    .from("payments")
    .update({
      payment_key: input.paymentKey,
      method: paymentMethod(toss.raw),
      amount: amounts.productAmount,
      status: paymentStatus,
      provider_status: toss.status,
      approved_at: approvedAt,
      paid_at: paymentStatus === "done" ? approvedAt : null,
      product_amount: amounts.productAmount,
      service_fee_amount: amounts.serviceFeeAmount,
      total_amount: amounts.totalAmount,
      online_payment_amount: amounts.onlinePaymentAmount,
      onsite_payment_amount: amounts.onsitePaymentAmount,
      onsite_payment_status: amounts.onsitePaymentAmount > 0 ? "PENDING" : "DONE",
      quote_status: nextQuoteStatus,
      receipt_url: receiptUrl(toss.raw)
    })
    .eq("id", payment.id)
    .select("*")
    .single();

  if (updatePaymentError) {
    if (isSchemaCompatibilityError(updatePaymentError)) {
      const fallback = await supabase
        .from("payments")
        .update({
          payment_key: input.paymentKey,
          method: paymentMethod(toss.raw),
          amount: amounts.productAmount,
          status: paymentStatus,
          provider_status: toss.status,
          approved_at: approvedAt,
          paid_at: paymentStatus === "done" ? approvedAt : null
        })
        .eq("id", payment.id)
        .select("*")
        .single();
      updatedPayment = fallback.data;
      updatePaymentError = fallback.error;
    }

    if (updatePaymentError) {
    return fail("internal_error", updatePaymentError.message, 500);
    }
  }

  if (!updatedPayment) {
    return fail("internal_error", "Payment update failed.", 500);
  }

  const { error: eventError } = await supabase.from("payment_events").insert({
    payment_id: updatedPayment.id,
    event_type: "confirm",
    payload: toss.raw,
    idempotency_key: `confirm:${input.paymentKey}`
  });

  if (eventError && eventError.code !== "23505") {
    return fail("internal_error", eventError.message, 500);
  }

  if (paymentStatus === "done") {
    const orderUpdate = await supabase
      .from("orders")
      .update({
        status: nextOrderStatus,
        payment_key: input.paymentKey,
        online_payment_amount: amounts.onlinePaymentAmount,
        onsite_payment_amount: amounts.onsitePaymentAmount,
        onsite_payment_status: amounts.onsitePaymentAmount > 0 ? "PENDING" : "DONE"
      })
      .eq("id", payment.order_id);

    if (orderUpdate.error && isSchemaCompatibilityError(orderUpdate.error)) {
      await supabase
        .from("orders")
        .update({
          status: "paid",
          payment_key: input.paymentKey
        })
        .eq("id", payment.order_id);
    }

    await supabase.from("events").insert({
      event_type: EVENT_TYPES.PAYMENT_COMPLETED,
      order_id: payment.order_id,
      customer_id: order.customer_id ?? null,
      session_id: order.session_id ?? null,
      source: order.source ?? order.channel ?? null,
      campaign: order.campaign ?? null,
      landing_path: order.landing_path ?? null,
      device_type: order.device_type ?? null,
      service_code: order.service_type_code ?? null,
      region_code: order.region_code ?? null,
      properties: {
        payment_id: updatedPayment.id,
        quote_id: quote.id,
        provider_order_id: input.orderId,
        amount: amounts.productAmount,
        product_amount: amounts.productAmount,
        service_fee_amount: amounts.serviceFeeAmount,
        total_amount: amounts.totalAmount,
        provider_status: toss.status
      }
    });

    void notifyPaymentCompleted({
      orderId: payment.order_id,
      orderNumber: order.order_number,
      customerName: order.customers?.name ?? "고객",
      amount: amounts.productAmount
    });
  }

  if (paymentStatus !== "done") {
    logOperation({
      requestId,
      endpoint: "/api/payments/confirm",
      method: "POST",
      identifiers: { order_id: payment.order_id, payment_id: payment.id },
      success: false,
      errorCode: "PAYMENT_NOT_DONE"
    });
    return fail("PAYMENT_ERROR", "Toss payment was not approved.", 400, toss.raw);
  }

  logOperation({
    requestId,
    endpoint: "/api/payments/confirm",
    method: "POST",
    identifiers: { order_id: payment.order_id, payment_id: payment.id },
    success: true
  });

  return ok({
    duplicate: false,
    payment: updatedPayment,
    order,
    toss,
    amount: amounts.productAmount,
    productAmount: amounts.productAmount,
    serviceFeeAmount: amounts.serviceFeeAmount,
    totalAmount: amounts.totalAmount,
    onsitePaymentAmount: amounts.onsitePaymentAmount
  });
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const body = await readJson(request);
  const parsed = paymentConfirmSchema.safeParse(body);

  if (!parsed.success) {
    logOperation({
      requestId,
      endpoint: "/api/payments/confirm",
      method: "POST",
      success: false,
      errorCode: "VALIDATION_ERROR"
    });
    return validationError(parsed.error, "Invalid payment confirm request.");
  }

  return confirmPreparedPayment(parsed.data, requestId);
}

export async function GET(request: Request) {
  const requestId = createRequestId();
  const { searchParams } = new URL(request.url);
  const parsed = paymentConfirmSchema.safeParse({
    paymentKey: searchParams.get("paymentKey"),
    orderId: searchParams.get("orderId"),
    amount: searchParams.get("amount")
  });

  if (!parsed.success) {
    logOperation({
      requestId,
      endpoint: "/api/payments/confirm",
      method: "GET",
      success: false,
      errorCode: "VALIDATION_ERROR"
    });
    return validationError(parsed.error, "Invalid payment confirm request.");
  }

  return confirmPreparedPayment(parsed.data, requestId);
}
