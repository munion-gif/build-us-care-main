import { NextResponse } from "next/server";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

export function getClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || headers.get("x-real-ip") || "unknown";
}

export function checkRateLimit(key: string, options: RateLimitOptions) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(options.limit - 1, 0),
      resetAt,
      retryAfterSeconds: 0
    };
  }

  current.count += 1;
  const allowed = current.count <= options.limit;
  return {
    allowed,
    remaining: Math.max(options.limit - current.count, 0),
    resetAt: current.resetAt,
    retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1)
  };
}

export function clearRateLimit(key: string) {
  buckets.delete(key);
}

export function rateLimitResponse(retryAfterSeconds: number, message = "요청이 많습니다. 잠시 후 다시 시도해주세요.") {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message
      }
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds)
      }
    }
  );
}
