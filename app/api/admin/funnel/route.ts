import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { ADMIN_FUNNEL_STEPS, buildAdminFunnelReport } from "@/lib/admin-funnel";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const revalidate = 300;

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") === "30d" ? "30d" : "7d";
  const since = new Date(Date.now() - (period === "30d" ? 30 : 7) * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("events")
    .select("id,event_type,session_id,source,properties")
    .in("event_type", [...ADMIN_FUNNEL_STEPS])
    .gte("occurred_at", since);

  if (error) return fail("internal_error", error.message, 500);

  const report = buildAdminFunnelReport(data ?? []);

  return ok({
    period,
    steps: report.steps,
    channels: report.channels
  });
}
