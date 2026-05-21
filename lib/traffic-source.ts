export type TrafficSource = "instagram" | "direct" | "organic" | "kakao" | "phone" | "web" | "unknown";

export type SourceContext = {
  trafficSource: TrafficSource;
  source?: string;
  campaign?: string;
  medium?: string;
  region?: string;
  ref?: string;
  landingPath?: string;
  isInstagram: boolean;
};

const STORAGE_KEY = "buildus_source_context";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function clean(value?: string | null) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : undefined;
}

export function normalizeTrafficSource(params: {
  source?: string | null;
  medium?: string | null;
  ref?: string | null;
}): TrafficSource {
  const source = clean(params.source)?.toLowerCase();
  const medium = clean(params.medium)?.toLowerCase();
  const ref = clean(params.ref)?.toLowerCase();

  if (source === "instagram" || ref === "instagram") return "instagram";
  if (source === "kakao") return "kakao";
  if (source === "phone") return "phone";
  if (source === "organic") return "organic";
  if (source === "direct") return "direct";
  if (source === "web") return "web";
  if (!source && medium === "social" && ref === "instagram") return "instagram";
  if (!source && !medium && !ref) return "direct";
  return "unknown";
}

export function createSourceContext(params: {
  source?: string | null;
  campaign?: string | null;
  medium?: string | null;
  region?: string | null;
  ref?: string | null;
  landingPath?: string | null;
}): SourceContext {
  const trafficSource = normalizeTrafficSource(params);
  return {
    trafficSource,
    source: clean(params.source),
    campaign: clean(params.campaign),
    medium: clean(params.medium),
    region: clean(params.region),
    ref: clean(params.ref),
    landingPath: clean(params.landingPath),
    isInstagram: trafficSource === "instagram"
  };
}

export function sourceContextFromSearchParams(searchParams: Record<string, string | string[] | undefined>): SourceContext {
  return createSourceContext({
    source: firstValue(searchParams.utm_source) ?? firstValue(searchParams.source),
    campaign: firstValue(searchParams.utm_campaign) ?? firstValue(searchParams.campaign),
    medium: firstValue(searchParams.utm_medium) ?? firstValue(searchParams.medium),
    region: firstValue(searchParams.region),
    ref: firstValue(searchParams.ref)
  });
}

export function sourceContextFromUrlSearchParams(searchParams: URLSearchParams, landingPath?: string): SourceContext {
  return createSourceContext({
    source: searchParams.get("utm_source") ?? searchParams.get("source"),
    campaign: searchParams.get("utm_campaign") ?? searchParams.get("campaign"),
    medium: searchParams.get("utm_medium") ?? searchParams.get("medium"),
    region: searchParams.get("region"),
    ref: searchParams.get("ref"),
    landingPath
  });
}

export function persistSourceContext(context: SourceContext) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Ignore storage failures.
  }
}

export function readStoredSourceContext() {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return createSourceContext(JSON.parse(stored) as Partial<SourceContext>);
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function readClientSourceContext() {
  if (typeof window === "undefined") {
    return createSourceContext({});
  }

  const current = sourceContextFromUrlSearchParams(new URLSearchParams(window.location.search), window.location.pathname);
  const hasExplicitParams = Boolean(current.source || current.campaign || current.medium || current.ref || current.region);

  if (hasExplicitParams) {
    persistSourceContext(current);
    return current;
  }

  const stored = readStoredSourceContext();
  if (stored) {
    const next = createSourceContext({ ...stored, landingPath: window.location.pathname });
    persistSourceContext(next);
    return next;
  }

  return current;
}

export function appendSourceParams(href: string, context?: Partial<SourceContext> | null) {
  if (!context) return href;

  const url = new URL(href, "https://buildus.local");
  if (context.source) url.searchParams.set("utm_source", context.source);
  if (context.campaign) url.searchParams.set("utm_campaign", context.campaign);
  if (context.medium) url.searchParams.set("utm_medium", context.medium);
  if (context.region) url.searchParams.set("region", context.region);
  if (context.ref) url.searchParams.set("ref", context.ref);

  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}
