import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

type AdminSessionPayload = {
  iat: number;
  exp: number;
  nonce: string;
};

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signaturesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAdminSessionToken(secret: string, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const payload: AdminSessionPayload = {
    iat: issuedAt,
    exp: issuedAt + ADMIN_SESSION_MAX_AGE_SECONDS,
    nonce: randomBytes(16).toString("base64url")
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}

export function verifyAdminSessionToken(token: string | undefined | null, secret: string | undefined, now = Date.now()) {
  if (!token || !secret) return false;

  const [encodedPayload, signature, ...rest] = token.split(".");
  if (!encodedPayload || !signature || rest.length > 0) return false;

  const expectedSignature = signPayload(encodedPayload, secret);
  if (!signaturesMatch(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<AdminSessionPayload>;
    const currentSeconds = Math.floor(now / 1000);
    return typeof payload.exp === "number" && typeof payload.iat === "number" && payload.exp > currentSeconds && payload.iat <= currentSeconds + 60;
  } catch {
    return false;
  }
}
