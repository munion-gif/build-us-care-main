import { fail, ok } from "@/lib/api-response";
import { hasAdminAccess } from "@/lib/admin-auth";
import { isLocalAdminDevBypassEnabled } from "@/lib/admin-ip-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasAdminAccess(request)) {
    return fail("unauthorized", "관리자 로그인이 필요합니다.", 401);
  }

  return ok({ authenticated: true, localMode: isLocalAdminDevBypassEnabled(request.headers) });
}
