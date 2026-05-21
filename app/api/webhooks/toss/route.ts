import { fail, ok } from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { isPaymentMockMode, verifyTossWebhookSignature } from "@/lib/toss";
import { tossWebhookSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const requestId = createRequestId();

  if (!hasSupabaseEnv()) {
    logOperation({
      requestId,
      endpoint: "/api/webhooks/toss",
      method: "POST",
      success: false,
      errorCode: "SUPABASE_NOT_CONFIGURED"
    });
    return fail("supabase_not_configured", "Supabase is required to store webhook events.", 500);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-toss-signature") ?? request.headers.get("toss-signature");
  const mockMode = isPaymentMockMode();
  const webhookSecret = process.env.TOSS_WEBHOOK_SECRET;

  if (!mockMode && webhookSecret) {
    const authorization = request.headers.get("authorization");
    const expectedAuth = `Basic ${Buffer.from(`${webhookSecret}:`).toString("base64")}`;
    const hasValidBasicAuth = authorization === expectedAuth;
    const hasValidSignature = verifyTossWebhookSignature(rawBody, signature, webhookSecret);

    if (!hasValidBasicAuth && !hasValidSignature) {
      logOperation({
        requestId,
        endpoint: "/api/webhooks/toss",
        method: "POST",
        success: false,
        errorCode: "WEBHOOK_SIGNATURE_INVALID"
      });
      return fail("WEBHOOK_SIGNATURE_INVALID", "Invalid Toss webhook signature.", 401);
    }
  }

  if (!mockMode && !webhookSecret) {
    logOperation({
      requestId,
      endpoint: "/api/webhooks/toss",
      method: "POST",
      success: false,
      errorCode: "WEBHOOK_SIGNATURE_INVALID"
    });
    return fail("WEBHOOK_SIGNATURE_INVALID", "Invalid Toss webhook signature.", 401);
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(rawBody || "{}") as Record<string, unknown>;
  } catch {
    logOperation({
      requestId,
      endpoint: "/api/webhooks/toss",
      method: "POST",
      success: false,
      errorCode: "VALIDATION_ERROR"
    });
    return fail("VALIDATION_ERROR", "Invalid JSON payload.", 400);
  }
  const parsed = tossWebhookSchema.safeParse(payload);

  if (!parsed.success) {
    logOperation({
      requestId,
      endpoint: "/api/webhooks/toss",
      method: "POST",
      success: false,
      errorCode: "VALIDATION_ERROR"
    });
    return validationError(parsed.error, "Invalid Toss webhook payload.");
  }

  if (!payload || Object.keys(payload).length === 0) {
    return fail("bad_request", "Invalid JSON payload.", 400);
  }

  const eventType = String(parsed.data.eventType);
  const paymentKey = parsed.data.paymentKey ?? null;
  const idempotencyKey =
    request.headers.get("x-toss-event-id") ??
    request.headers.get("x-idempotency-key") ??
    (paymentKey ? `${eventType}:${paymentKey}` : null);

  const supabase = getSupabaseAdmin();
  let paymentId: string | null = null;

  if (paymentKey) {
    const { data: payment } = await supabase.from("payments").select("id").eq("payment_key", paymentKey).maybeSingle();
    paymentId = payment?.id ?? null;

    if (paymentId) {
      await supabase
        .from("payment_events")
        .update({ payment_id: paymentId })
        .eq("payload->>paymentKey", paymentKey)
        .is("payment_id", null);
    }
  }

  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from("payment_events")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing) {
      logOperation({
        requestId,
        endpoint: "/api/webhooks/toss",
        method: "POST",
        identifiers: { event_id: existing.id, payment_key_present: Boolean(paymentKey) },
        success: true
      });
      return ok({
        duplicate: true,
        event_id: existing.id
      });
    }
  }

  const { data, error } = await supabase
    .from("payment_events")
    .insert({
      payment_id: paymentId,
      event_type: eventType,
      payload,
      idempotency_key: idempotencyKey
    })
    .select("*")
    .single();

  if (error) {
    logOperation({
      requestId,
      endpoint: "/api/webhooks/toss",
      method: "POST",
      identifiers: { payment_id: paymentId },
      success: false,
      errorCode: "WEBHOOK_EVENT_RECORD_FAILED"
    });
    return fail("conflict", error.message, 409);
  }

  logOperation({
    requestId,
    endpoint: "/api/webhooks/toss",
    method: "POST",
    identifiers: { payment_id: paymentId, event_id: data.id },
    success: true
  });

  return ok({ duplicate: false, event: data }, { status: 201 });
}
