type HeaderReader = {
  get(name: string): string | null;
};

function normalizeIp(value: string | undefined | null) {
  const ip = value?.trim();
  if (!ip) return "";
  return ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip;
}

function ipToLong(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts.reduce((sum, part) => (sum << 8) + part, 0) >>> 0;
}

function ipMatchesRule(ip: string, rule: string) {
  const normalizedRule = normalizeIp(rule);
  if (!normalizedRule) return false;
  if (!normalizedRule.includes("/")) return ip === normalizedRule;

  const [baseIp, prefixText] = normalizedRule.split("/");
  const prefix = Number(prefixText);
  const baseLong = ipToLong(baseIp);
  const ipLong = ipToLong(ip);
  if (baseLong === null || ipLong === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (baseLong & mask) === (ipLong & mask);
}

function adminAllowedIpRules(allowedIps = process.env.ADMIN_ALLOWED_IPS) {
  return (allowedIps ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getRequestIps(headers: HeaderReader) {
  const forwarded = headers.get("x-forwarded-for")?.split(",").map(normalizeIp).filter(Boolean) ?? [];
  const realIp = normalizeIp(headers.get("x-real-ip"));
  return [...forwarded, realIp].filter(Boolean);
}

export function isAdminIpBypassEnabled(flag = process.env.ADMIN_IP_BYPASS_LOGIN) {
  const value = (flag ?? "").trim().replace(/^["']|["']$/g, "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function hasConfiguredAdminSecret(value: string | undefined | null) {
  return Boolean(value?.trim().replace(/^["']|["']$/g, "").trim());
}

export function isLocalAdminDevBypassEnabled(
  headers: HeaderReader,
  host: string | null = headers.get("host"),
  adminApiKey = process.env.ADMIN_API_KEY,
  adminPassword = process.env.ADMIN_PASSWORD,
  adminSessionSecret = process.env.ADMIN_SESSION_SECRET
) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    return false;
  }

  const normalizedHost = host ?? "";
  const isLocalHost =
    normalizedHost.startsWith("localhost") ||
    normalizedHost.startsWith("127.0.0.1") ||
    normalizedHost.startsWith("[::1]");

  if (!isLocalHost) {
    return false;
  }

  return !hasConfiguredAdminSecret(adminApiKey) && !hasConfiguredAdminSecret(adminPassword) && !hasConfiguredAdminSecret(adminSessionSecret);
}

export function isAdminIpAllowed(headers: HeaderReader, host: string | null = headers.get("host"), allowedIps = process.env.ADMIN_ALLOWED_IPS) {
  const rules = adminAllowedIpRules(allowedIps);
  if (rules.length === 0) return true;

  const normalizedHost = host ?? "";
  const isLocalHost =
    normalizedHost.startsWith("localhost") ||
    normalizedHost.startsWith("127.0.0.1") ||
    normalizedHost.startsWith("[::1]");
  if (process.env.VERCEL !== "1" && isLocalHost) return true;

  const ips = getRequestIps(headers);
  return ips.some((ip) => rules.some((rule) => ipMatchesRule(ip, rule)));
}
