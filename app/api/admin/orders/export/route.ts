import { fail } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { csvEscape } from "@/lib/data-collection";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const revalidate = 0;

const COLUMNS = [
  "order_id",
  "created_at",
  "service_code",
  "region_code",
  "source",
  "campaign",
  "soft_launch_flag",
  "amount_final",
  "status_final",
  "lead_time_first_contact_min",
  "lead_time_done_min",
  "quality_flag",
  "warranty_flag",
  "feedback_score_overall"
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
  let query = supabase.from("analytics_orders_export").select(COLUMNS.join(",")).order("created_at", { ascending: false });

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const source = searchParams.get("source");
  const campaign = searchParams.get("campaign");

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lt("created_at", to);
  if (source) query = query.eq("source", source);
  if (campaign) query = query.eq("campaign", campaign);

  const { data, error } = await query.limit(10000);
  if (error) return fail("internal_error", error.message, 500);

  return new Response(csv((data ?? []) as unknown as Record<string, unknown>[]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-export-${source ?? "all"}-${campaign ?? "all"}.csv"`
    }
  });
}
