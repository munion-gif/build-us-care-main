export const PRIMARY_INSTAGRAM_CAMPAIGN = "suwon_toilet_fixed_price";

export const DIM_CHANNELS = [
  { code: "instagram", name: "Instagram", description: "Instagram paid/social traffic" },
  { code: "kakao", name: "Kakao", description: "Kakao channel traffic" },
  { code: "web", name: "Web", description: "General web traffic" },
  { code: "direct", name: "Direct", description: "Direct or no-referrer traffic" },
  { code: "organic", name: "Organic", description: "Organic search or unpaid discovery" },
  { code: "offline", name: "Offline", description: "Offline/manual source" }
] as const;

export const DIM_CAMPAIGNS = [
  {
    code: PRIMARY_INSTAGRAM_CAMPAIGN,
    name: "수원 변기 교체 정찰가 캠페인",
    description: "First Instagram campaign for fixed-price toilet replacement in Suwon"
  }
] as const;

export const FUNNEL_EVENT_TYPES = [
  "landing_view",
  "quote_start",
  "quote_submit",
  "payment_done",
  "order_lookup",
  "status_view",
  "photo_request_start",
  "photo_result_view"
] as const;

const EVENT_ALIASES: Record<string, string> = {
  instagram_landing_view: "landing_view",
  quote_started: "quote_start",
  quote_submitted: "quote_submit",
  payment_completed: "payment_done",
  order_lookup_from_instagram: "order_lookup",
  status_page_view: "status_view"
};

function clean(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

export function normalizeFunnelEventType(eventType: string) {
  return EVENT_ALIASES[eventType] ?? eventType;
}

export function normalizeSource(value: unknown, fallback?: unknown) {
  const raw = clean(value) ?? clean(fallback);
  if (!raw) return "direct";
  const source = raw.toLowerCase();
  if (source === "instagram" || source === "ig") return "instagram";
  if (source === "kakao") return "kakao";
  if (source === "organic") return "organic";
  if (source === "offline") return "offline";
  if (source === "direct") return "direct";
  return source;
}

export function normalizeCampaign(value: unknown) {
  return clean(value);
}

export function inferDeviceType(userAgent?: string | null) {
  const ua = String(userAgent ?? "").toLowerCase();
  return /android|iphone|ipad|ipod|mobile|instagram/.test(ua) ? "mobile" : "desktop";
}

export function pickTrackingContext(properties: Record<string, unknown> = {}, userAgent?: string | null) {
  const source = normalizeSource(properties.source ?? properties.utm_source ?? properties.traffic_source);
  return {
    source,
    campaign: normalizeCampaign(properties.campaign ?? properties.utm_campaign),
    landing_path: clean(properties.landing_path ?? properties.page_path),
    device_type: clean(properties.device_type) ?? inferDeviceType(userAgent),
    service_code: clean(properties.service_code ?? properties.service_type_code),
    region_code: clean(properties.region_code ?? properties.region),
    meta_note: clean(properties.meta_note)
  };
}

export function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
