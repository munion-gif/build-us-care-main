import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { validationError } from "@/lib/errors";
import { insertJobStatusLog } from "@/lib/jobs";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id", method: "GET", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }

  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to read jobs.", 500);
  }

  const { id } = await context.params;
  const jobId = uuidSchema.safeParse(id);

  if (!jobId.success) {
    return validationError(jobId.error, "Invalid job id.");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("jobs")
    .select(
      `
      *,
      technicians (*),
      orders (
        *,
        customers (*),
        homes (*),
        quotes (*),
        payments (*)
      ),
      media (*),
      inspections (*),
      job_status_logs (*)
    `
    )
    .eq("id", jobId.data)
    .maybeSingle();

  if (error) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id", method: "GET", adminKeyId, identifiers: { job_id: jobId.data }, success: false, errorCode: "INTERNAL_ERROR" });
    return fail("internal_error", error.message, 500);
  }

  if (!data) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id", method: "GET", adminKeyId, identifiers: { job_id: jobId.data }, success: false, errorCode: "NOT_FOUND" });
    return fail("not_found", "Job not found.", 404);
  }

  logOperation({ requestId, endpoint: "/api/admin/jobs/:id", method: "GET", adminKeyId, identifiers: { job_id: jobId.data }, success: true });
  return ok({ job: data });
}

export async function DELETE(request: Request, context: Context) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id", method: "DELETE", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }

  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to cancel jobs.", 500);
  }

  const { id } = await context.params;
  const jobId = uuidSchema.safeParse(id);

  if (!jobId.success) {
    return validationError(jobId.error, "Invalid job id.");
  }

  const supabase = getSupabaseAdmin();
  const { data: existingJob, error: readError } = await supabase
    .from("jobs")
    .select("id,order_id,status")
    .eq("id", jobId.data)
    .maybeSingle();

  if (readError) return fail("internal_error", readError.message, 500);
  if (!existingJob) return fail("not_found", "Job not found.", 404);

  const { error: updateError } = await supabase
    .from("jobs")
    .update({ status: "cancelled" })
    .eq("id", jobId.data);

  if (updateError) return fail("internal_error", updateError.message, 500);

  await Promise.all([
    insertJobStatusLog(supabase, jobId.data, existingJob.status ?? null, "cancelled", "관리자 배정 취소"),
    supabase.from("orders").update({ status: "paid" }).eq("id", existingJob.order_id)
  ]);

  logOperation({ requestId, endpoint: "/api/admin/jobs/:id", method: "DELETE", adminKeyId, identifiers: { job_id: jobId.data, order_id: existingJob.order_id }, success: true });
  return ok({ cancelled: true, synced_order_status: "paid" });
}
