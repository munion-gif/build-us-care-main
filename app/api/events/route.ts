import { z } from "zod";
import { after } from "next/server";
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

type EventPayload = z.infer<typeof schema>;

async function persistEvent(payload: EventPayload, userAgent: string | null) {
  const supabase = getSupabaseAdmin();
  const eventType = normalizeFunnelEventType(payload.event_type ?? payload.eventType ?? "");
  let customerId = payload.customer_id ?? null;
  const properties = payload.properties ?? {};
  const tracking = pickTrackingContext(properties, userAgent);

  if (payload.order_id) {
    const { data: order, error } = await supabase.from("orders").select("customer_id").eq("id", payload.order_id).maybeSingle();
    if (error) throw error;
    customerId = order?.customer_id ?? customerId;
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      event_type: eventType,
      session_id: payload.session_id ?? null,
      order_id: payload.order_id ?? null,
      customer_id: customerId,
      source: tracking.source,
      campaign: tracking.campaign,
      landing_path: tracking.landing_path,
      device_type: tracking.device_type,
      service_code: tracking.service_code,
      region_code: tracking.region_code,
      meta_note: tracking.meta_note,
      properties,
      occurred_at: payload.occurred_at ?? payload.occurredAt ?? new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!payload.session_id) return;

  const sessionPatch = {
    source: tracking.source,
    campaign: tracking.campaign,
    landing_path: tracking.landing_path,
    device_type: tracking.device_type,
    region_hint: tracking.region_code,
    order_id: payload.order_id ?? null,
    updated_at: new Date().toISOString()
  };
  const { data: existingSession } = await supabase.from("sessions").select("session_id").eq("session_id", payload.session_id).maybeSingle();
  if (existingSession) {
    await supabase
      .from("sessions")
      .update({
        ...(payload.order_id ? { order_id: payload.order_id } : {}),
        updated_at: sessionPatch.updated_at
      })
      .eq("session_id", payload.session_id);
    return;
  }

  await supabase.from("sessions").insert({
    session_id: payload.session_id,
    first_event_time: payload.occurred_at ?? payload.occurredAt ?? new Date().toISOString(),
    ...sessionPatch
  });

  return data.id;
}

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

  const eventType = normalizeFunnelEventType(parsed.data.event_type ?? parsed.data.eventType ?? "");
  if (!eventType) return fail("BAD_REQUEST", "eventType is required.", 400);

  const userAgent = request.headers.get("user-agent");
  after(async () => {
    try {
      await persistEvent(parsed.data, userAgent);
    } catch (error) {
      console.error("[events] failed to persist event", error);
    }
  });

  return ok({ accepted: true }, { status: 202 });
}
