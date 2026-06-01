import { fail } from "@/lib/api-response";
import { verifyAdminSessionToken } from "@/lib/admin-session";
import { fingerprintSecret } from "@/lib/operational-log";

export function requireAdmin(request: Request) {
  if (hasAdminAccess(request)) {
    return null;
  }

  const expected = parseAdminKeys();
  const provided = request.headers.get("x-admin-key");

  if (!provided) {
    return fail("unauthorized", "Missing or invalid x-admin-key header.", 401);
  }

  if (expected.length === 0) {
    return fail("CONFIGURATION_ERROR", "ADMIN_API_KEY is not configured.", 503);
  }

  if (!expected.includes(provided)) {
    return fail("unauthorized", "Missing or invalid x-admin-key header.", 401);
  }

  return null;
}

export function hasAdminAccess(request: Request) {
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  const cookieSession = request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("admin_session="))
    ?.slice("admin_session=".length);

  if (verifyAdminSessionToken(cookieSession, sessionSecret)) {
    return true;
  }

  const provided = request.headers.get("x-admin-key");
  const expected = parseAdminKeys();
  return Boolean(provided && expected.includes(provided));
}

export function parseAdminKeys() {
  return (process.env.ADMIN_API_KEY ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

export function getAdminKeyId(request: Request) {
  const provided = request.headers.get("x-admin-key");
  return provided ? fingerprintSecret(provided) : null;
}
