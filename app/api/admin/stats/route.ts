import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const revalidate = 30;

function startOfToday() {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - 9 * 60 * 60 * 1000).toISOString();
}

function startOfTomorrow() {
  return new Date(new Date(startOfToday()).getTime() + 24 * 60 * 60 * 1000).toISOString();
}

function startOfWeek() {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kstNow.getUTCDay();
  const mondayDate = kstNow.getUTCDate() + (day === 0 ? -6 : 1 - day);
  return new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), mondayDate) - 9 * 60 * 60 * 1000).toISOString();
}

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const supabase = getSupabaseAdmin();
  const today = startOfToday();
  const tomorrow = startOfTomorrow();
  const week = startOfWeek();
  const [todayOrders, todayPaid, pendingDiagnoses, weekCompletedJobs, weekPayments, feedbacks, pendingQuotes, issueJobs] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", today).lt("created_at", tomorrow),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "done").gte("paid_at", today).lt("paid_at", tomorrow),
    supabase.from("diagnoses").select("id", { count: "exact", head: true }).is("result", null),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "inspected").gte("ended_at", week),
    supabase.from("payments").select("amount").eq("status", "done").gte("paid_at", week),
    supabase.from("feedbacks").select("nps").not("nps", "is", null),
    supabase.from("quotes").select("id", { count: "exact", head: true }).is("accepted_at", null),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "issue")
  ]);

  const npsRows = feedbacks.data ?? [];
  const avgNps = npsRows.length
    ? Math.round((npsRows.reduce((sum, row: any) => sum + Number(row.nps ?? 0), 0) / npsRows.length) * 10) / 10
    : null;

  return ok({
    todayOrders: todayOrders.count ?? 0,
    todayPaid: todayPaid.count ?? 0,
    pendingDiagnoses: pendingDiagnoses.count ?? 0,
    weekCompletedJobs: weekCompletedJobs.count ?? 0,
    avgNps,
    weekRevenue: (weekPayments.data ?? []).reduce((sum, row: any) => sum + Number(row.amount ?? 0), 0),
    pendingQuotes: pendingQuotes.count ?? 0,
    issueJobs: issueJobs.count ?? 0
  });
}
