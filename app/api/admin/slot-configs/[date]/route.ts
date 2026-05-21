import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

type Context = {
  params: Promise<{ date: string }>;
};

export async function DELETE(request: Request, context: Context) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/slot-configs/[date]", method: "DELETE", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { date } = await context.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("BAD_REQUEST", "Invalid date.", 400);

  const { error } = await getSupabaseAdmin()
    .from("slot_configs")
    .delete()
    .eq("date", date)
    .eq("type", "date");

  if (error) return fail("internal_error", error.message, 500);
  return ok({ deleted: true, date });
}
