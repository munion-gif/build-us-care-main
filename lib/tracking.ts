import { readClientSourceContext } from "@/lib/traffic-source";

let memorySessionId: string | null = null;
let memoryUtm: Record<string, string> = {};

function safeRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getSessionId() {
  if (typeof window === "undefined") return memorySessionId ?? (memorySessionId = safeRandomId());
  try {
    const existing = sessionStorage.getItem("buildus_session_id");
    if (existing) return existing;
    const next = safeRandomId();
    sessionStorage.setItem("buildus_session_id", next);
    return next;
  } catch {
    return memorySessionId ?? (memorySessionId = safeRandomId());
  }
}

export function getUtmParams() {
  if (typeof window === "undefined") return memoryUtm;
  const sourceContext = readClientSourceContext();
  const next: Record<string, string> = {};
  if (sourceContext.source) next.utm_source = sourceContext.source;
  if (sourceContext.campaign) next.utm_campaign = sourceContext.campaign;
  if (sourceContext.medium) next.utm_medium = sourceContext.medium;
  next.traffic_source = sourceContext.trafficSource;
  if (sourceContext.ref) next.ref = sourceContext.ref;
  if (sourceContext.landingPath) next.landing_path = sourceContext.landingPath;
  next.device_type = getDeviceType();
  if (document.referrer) next.referrer_url = document.referrer;

  try {
    if (Object.keys(next).length > 0) sessionStorage.setItem("buildus_utm", JSON.stringify(next));
    const stored = sessionStorage.getItem("buildus_utm");
    return stored ? (JSON.parse(stored) as Record<string, string>) : next;
  } catch {
    memoryUtm = Object.keys(next).length > 0 ? next : memoryUtm;
    return memoryUtm;
  }
}

export function getDeviceType() {
  if (typeof navigator === "undefined") return "desktop";
  return /android|iphone|ipad|ipod|mobile|instagram/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

export async function track(
  eventType: string,
  properties: Record<string, unknown> = {},
  context: { orderId?: string; customerId?: string } = {}
) {
  try {
    const utm = getUtmParams();
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_type: eventType,
        session_id: getSessionId(),
        order_id: context.orderId,
        customer_id: context.customerId,
        properties: {
          ...utm,
          page_path: typeof window !== "undefined" ? window.location.pathname : undefined,
          ...properties
        }
      })
    });
  } catch {
    // Analytics must never break the user flow.
  }
}
