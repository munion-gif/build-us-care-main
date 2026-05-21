import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const revalidate = 30;

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const supabase = getSupabaseAdmin();
  const [{ data, error }, { count: cancelRequestedCount, error: cancelCountError }, { count: pendingDiagnosisCount, error: diagnosisCountError }] = await Promise.all([
    supabase
    .from("orders")
    .select("id,jobs(id,technician_id,status)")
      .eq("status", "paid"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "cancel_requested"),
    supabase
      .from("diagnoses")
      .select("id", { count: "exact", head: true })
      .is("result", null)
  ]);

  if (error ?? cancelCountError ?? diagnosisCountError) return fail("internal_error", (error ?? cancelCountError ?? diagnosisCountError)!.message, 500);

  const count = (data ?? []).filter((order: any) => {
    const jobs = Array.isArray(order.jobs) ? order.jobs : [];
    return !jobs.some((job: any) => job.technician_id && job.status !== "cancelled");
  }).length;

  return ok({ count, cancelRequestedCount: cancelRequestedCount ?? 0, pendingDiagnosisCount: pendingDiagnosisCount ?? 0 });
}
