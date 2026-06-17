import { NextRequest, NextResponse } from "next/server";
import { isAdminIpAllowed, isAdminIpBypassEnabled, isLocalAdminDevBypassEnabled } from "@/lib/admin-ip-access";

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

const retiredPublicApiPaths = new Set([
  "/api/quote",
  "/api/service-items",
  "/api/storage/upload-temp",
  "/api/orders/lookup",
  "/api/payments/prepare",
  "/api/payments/confirm",
  "/api/payments/toss/confirm",
  "/api/webhooks/toss"
]);

const retiredPublicApiPrefixes = [
  "/api/cases",
  "/api/diagnoses",
  "/api/faqs",
  "/api/quotes",
  "/api/reviews",
  "/api/reservations"
];

const retiredStaticPublicPaths = new Set([
  "/app-web.html",
  "/app-mobile.html",
  "/app-web.js",
  "/app.js"
]);

const legacyPublicRedirects = new Map<string, string>([
  ["/services", "/"],
  ["/cases", "/"],
  ["/products/toilets", "/products/toilet"],
  ["/products/basins", "/products/washbasin"],
  ["/products/window-handles", "/products/window-handle"],
  ["/products/door-handles", "/products/door-handle"],
  ["/products/bath-accessories", "/products/bath-accessory"]
]);

function isRetiredPublicApi(pathname: string) {
  return retiredPublicApiPaths.has(pathname) || retiredPublicApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(req: NextRequest) {
  const legacyRedirectPath = legacyPublicRedirects.get(req.nextUrl.pathname);
  if (legacyRedirectPath) {
    const redirectUrl = new URL(legacyRedirectPath, req.url);
    redirectUrl.search = req.nextUrl.search;
    return NextResponse.redirect(redirectUrl);
  }

  if (req.nextUrl.pathname === "/order-status") {
    const orderId = req.nextUrl.searchParams.get("id") ?? req.nextUrl.searchParams.get("orderId");
    if (orderId) {
      const redirectUrl = new URL(`/orders/${encodeURIComponent(orderId)}`, req.url);
      const accessToken = req.nextUrl.searchParams.get("accessToken");
      if (accessToken) redirectUrl.searchParams.set("accessToken", accessToken);
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (req.nextUrl.pathname === "/builduscare" || req.nextUrl.pathname.startsWith("/builduscare/")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (retiredStaticPublicPaths.has(req.nextUrl.pathname)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (isRetiredPublicApi(req.nextUrl.pathname)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Not found." } }, { status: 404 });
  }

  if (req.nextUrl.pathname.startsWith("/admin") || req.nextUrl.pathname.startsWith("/api/admin")) {
    const allowedByIp = isAdminIpAllowed(req.headers, req.headers.get("host"), process.env.ADMIN_ALLOWED_IPS);
    if (!allowedByIp) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const localDevBypass = isLocalAdminDevBypassEnabled(
      req.headers,
      req.headers.get("host"),
      process.env.ADMIN_API_KEY,
      process.env.ADMIN_PASSWORD,
      process.env.ADMIN_SESSION_SECRET
    );
    const bypassLogin = localDevBypass || (allowedByIp && isAdminIpBypassEnabled(process.env.ADMIN_IP_BYPASS_LOGIN));
    if (bypassLogin && req.nextUrl.pathname === "/admin/login") {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }

    if (!bypassLogin && req.nextUrl.pathname.startsWith("/admin") && req.nextUrl.pathname !== "/admin/login") {
      const cookie = req.cookies.get("admin_session")?.value;
      const hasAdminSession = await verifyAdminSessionToken(cookie, process.env.ADMIN_SESSION_SECRET);
      if (!hasAdminSession) {
        return NextResponse.redirect(new URL("/admin/login", req.url));
      }
    }
  }

  if (req.nextUrl.pathname.startsWith("/technician") && req.nextUrl.pathname !== "/technician/login") {
    const localTechnicianBypass = isLocalAdminDevBypassEnabled(
      req.headers,
      req.headers.get("host"),
      process.env.ADMIN_API_KEY,
      process.env.ADMIN_PASSWORD,
      process.env.ADMIN_SESSION_SECRET
    );
    if (localTechnicianBypass) {
      return NextResponse.next();
    }

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

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/technician/:path*",
    "/services",
    "/products/toilets",
    "/products/basins",
    "/products/window-handles",
    "/products/door-handles",
    "/products/bath-accessories",
    "/order-status",
    "/builduscare/:path*",
    "/builduscare",
    "/app-web.html",
    "/app-mobile.html",
    "/app-web.js",
    "/app.js",
    "/api/cases/:path*",
    "/api/diagnoses/:path*",
    "/api/faqs/:path*",
    "/api/quote",
    "/api/quotes/:path*",
    "/api/reviews/:path*",
    "/api/reservations/:path*",
    "/api/service-items",
    "/api/storage/upload-temp",
    "/api/orders/lookup",
    "/api/payments/prepare",
    "/api/payments/confirm",
    "/api/payments/toss/confirm",
    "/api/webhooks/toss"
  ]
};
