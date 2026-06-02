import { NextRequest, NextResponse } from "next/server";
import { isAdminIpAllowed, isAdminIpBypassEnabled } from "@/lib/admin-ip-access";

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

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/lab") && process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (req.nextUrl.pathname.startsWith("/admin") || req.nextUrl.pathname.startsWith("/api/admin")) {
    const allowedByIp = isAdminIpAllowed(req.headers);
    if (!allowedByIp) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const bypassLogin = allowedByIp && isAdminIpBypassEnabled();
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

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*", "/technician/:path*", "/lab/:path*"] };
