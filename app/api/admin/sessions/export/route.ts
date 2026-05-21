import { fail } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { csvEscape } from "@/lib/data-collection";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const revalidate = 0;

const COLUMNS = [
  "session_id",
  "first_event_time",
  "source",
  "campaign",
  "landing_path",
  "device_type",
  "region_hint",
  "order_id"
] as const;

function csv(rows: Record<string, unknown>[]) {
  return [COLUMNS.join(","), ...rows.map((row) => COLUMNS.map((column) => csvEscape(row[column])).join(","))].join("\n");
}

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { searchParams } = new URL(request.url);
  const supabase = getSupabaseAdmin();
  let query = supabase.from("analytics_sessions_export").select(COLUMNS.join(",")).order("first_event_time", { ascending: false });

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const source = searchParams.get("source");
  const campaign = searchParams.get("campaign");

  if (from) query = query.gte("first_event_time", from);
  if (to) query = query.lt("first_event_time", to);
  if (source) query = query.eq("source", source);
  if (campaign) query = query.eq("campaign", campaign);

  const { data, error } = await query.limit(50000);
  if (error) return fail("internal_error", error.message, 500);

  return new Response(csv((data ?? []) as unknown as Record<string, unknown>[]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sessions-export-${source ?? "all"}-${campaign ?? "all"}.csv"`
    }
  });
}
