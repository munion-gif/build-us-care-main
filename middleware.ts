import { NextRequest, NextResponse } from "next/server";

const textEncoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return atob(padded);
}

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

function getRequestIps(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",").map(normalizeIp).filter(Boolean) ?? [];
  const realIp = normalizeIp(req.headers.get("x-real-ip"));
  return [...forwarded, realIp].filter(Boolean);
}

function isAdminIpAllowed(req: NextRequest) {
  const rules = (process.env.ADMIN_ALLOWED_IPS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (rules.length === 0) return true;

  const host = req.headers.get("host") ?? "";
  const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
  if (process.env.VERCEL !== "1" && isLocalHost) return true;

  const ips = getRequestIps(req);
  return ips.some((ip) => rules.some((rule) => ipMatchesRule(ip, rule)));
}

async function signAdminSessionPayload(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

async function verifyAdminSessionToken(token: string | undefined, secret: string | undefined) {
  if (!token || !secret) return false;

  const [encodedPayload, signature, ...rest] = token.split(".");
  if (!encodedPayload || !signature || rest.length > 0) return false;

  const expectedSignature = await signAdminSessionPayload(encodedPayload, secret);
  if (signature !== expectedSignature) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as { exp?: unknown; iat?: unknown };
    const currentSeconds = Math.floor(Date.now() / 1000);
    return typeof payload.exp === "number" && typeof payload.iat === "number" && payload.exp > currentSeconds && payload.iat <= currentSeconds + 60;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/lab") && process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (req.nextUrl.pathname.startsWith("/admin")) {
    if (!isAdminIpAllowed(req)) {
      return new NextResponse("Not Found", { status: 404 });
    }

    if (req.nextUrl.pathname !== "/admin/login") {
      const cookie = req.cookies.get("admin_session")?.value;
      const hasAdminSession = await verifyAdminSessionToken(cookie, process.env.ADMIN_SESSION_SECRET);
      if (!hasAdminSession) {
        return NextResponse.redirect(new URL("/admin/login", req.url));
      }
    }
  }

  if (req.nextUrl.pathname.startsWith("/technician") && req.nextUrl.pathname !== "/technician/login") {
    const token = req.nextUrl.searchParams.get("token");
    if (token) {
      const redirectUrl = new URL("/technician", req.url);
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.set("tech_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/technician",
        maxAge: 60 * 60 * 24 * 30
      });
      return response;
    }

    const cookie = req.cookies.get("tech_session")?.value;
    if (!cookie) {
      return NextResponse.redirect(new URL("/technician/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/technician/:path*", "/lab/:path*"] };
