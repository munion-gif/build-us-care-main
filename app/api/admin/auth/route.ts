import { NextResponse } from "next/server";
import { readJson } from "@/lib/errors";
import { ADMIN_SESSION_MAX_AGE_SECONDS, createAdminSessionToken } from "@/lib/admin-session";
import { checkRateLimit, clearRateLimit, getClientIp } from "@/lib/rate-limit";

const ADMIN_LOGIN_LIMIT = 8;
const ADMIN_LOGIN_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) {
    return NextResponse.json({ ok: true, data: { localMode: true } });
  }

  const ip = getClientIp(request.headers);
  const rateLimitKey = `admin-login:${ip}`;
  const rateLimit = checkRateLimit(rateLimitKey, {
    limit: ADMIN_LOGIN_LIMIT,
    windowMs: ADMIN_LOGIN_WINDOW_MS
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "too_many_attempts",
          message: "로그인 시도가 많습니다. 잠시 후 다시 시도해주세요."
        }
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds)
        }
      }
    );
  }

  const body = await readJson(request);
  const password = typeof body?.password === "string" ? body.password : "";

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "비밀번호가 올바르지 않아요" } }, { status: 401 });
  }

  clearRateLimit(rateLimitKey);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin_session", createAdminSessionToken(process.env.ADMIN_SESSION_SECRET), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS
  });
  return response;
}
