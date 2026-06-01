import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { normalizeFunnelEventType, pickTrackingContext } from "@/lib/data-collection";
import { readJson, validationError } from "@/lib/errors";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

const schema = z.object({
  event_type: z.string().min(1).max(80).optional(),
  eventType: z.string().min(1).max(80).optional(),
  session_id: z.string().min(1).max(160).optional(),
  order_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  properties: z.record(z.unknown()).optional(),
  occurred_at: z.string().datetime().optional(),
  occurredAt: z.string().datetime().optional()
});

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(`events:${getClientIp(request.headers)}`, {
    limit: 60,
    windowMs: 60_000
  });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds, "이벤트 요청이 많습니다. 잠시 후 다시 시도해주세요.");
  }
  if (!hasSupabaseEnv() && process.env.NODE_ENV !== "production") {
    return ok({ skipped: true, reason: "supabase_not_configured" }, { status: 202 });
  }
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error, "Invalid event payload.");

  const supabase = getSupabaseAdmin();
  const eventType = normalizeFunnelEventType(parsed.data.event_type ?? parsed.data.eventType ?? "");
  if (!eventType) return fail("BAD_REQUEST", "eventType is required.", 400);
  let customerId = parsed.data.customer_id ?? null;
  const properties = parsed.data.properties ?? {};
  const tracking = pickTrackingContext(properties, request.headers.get("user-agent"));

  if (parsed.data.order_id) {
    const { data: order, error } = await supabase.from("orders").select("customer_id").eq("id", parsed.data.order_id).maybeSingle();
    if (error) return fail("internal_error", error.message, 500);
    customerId = order?.customer_id ?? customerId;
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      event_type: eventType,
      session_id: parsed.data.session_id ?? null,
      order_id: parsed.data.order_id ?? null,
      customer_id: customerId,
      source: tracking.source,
      campaign: tracking.campaign,
      landing_path: tracking.landing_path,
      device_type: tracking.device_type,
      service_code: tracking.service_code,
      region_code: tracking.region_code,
      meta_note: tracking.meta_note,
      properties,
      occurred_at: parsed.data.occurred_at ?? parsed.data.occurredAt ?? new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) return fail("internal_error", error.message, 500);
  if (parsed.data.session_id) {
    const sessionPatch = {
      source: tracking.source,
      campaign: tracking.campaign,
      landing_path: tracking.landing_path,
      device_type: tracking.device_type,
      region_hint: tracking.region_code,
      order_id: parsed.data.order_id ?? null,
      updated_at: new Date().toISOString()
    };
    const { data: existingSession } = await supabase.from("sessions").select("session_id").eq("session_id", parsed.data.session_id).maybeSingle();
    if (existingSession) {
      await supabase
        .from("sessions")
        .update({
          ...(parsed.data.order_id ? { order_id: parsed.data.order_id } : {}),
          updated_at: sessionPatch.updated_at
        })
        .eq("session_id", parsed.data.session_id);
    } else {
      await supabase.from("sessions").insert({
        session_id: parsed.data.session_id,
        first_event_time: parsed.data.occurred_at ?? parsed.data.occurredAt ?? new Date().toISOString(),
        ...sessionPatch
      });
    }
  }
  return ok({ id: data.id }, { status: 201 });
}
