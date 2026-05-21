import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { canTransitionJob } from "@/lib/status";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import type { JobStatus } from "@/lib/types";
import { jobStatusPatchSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

function orderStatusForJob(status: JobStatus) {
  if (status === "material_ready" || status === "assigned" || status === "scheduled") return "preparing";
  if (status === "in_progress") return "in_service";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  return null;
}

export async function PATCH(request: Request, context: Context) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id/status", method: "PATCH", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }

  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to update job status.", 500);
  }

  const { id } = await context.params;
  const jobId = uuidSchema.safeParse(id);

  if (!jobId.success) {
    return validationError(jobId.error, "Invalid job id.");
  }

  const body = await readJson(request);
  const parsed = jobStatusPatchSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid job status request.");
  }

  const supabase = getSupabaseAdmin();
  const { data: current, error: readError } = await supabase.from("jobs").select("*").eq("id", jobId.data).single();

  if (readError || !current) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id/status", method: "PATCH", adminKeyId, identifiers: { job_id: jobId.data }, success: false, errorCode: "NOT_FOUND" });
    return fail("not_found", "Job not found.", 404);
  }

  if (!canTransitionJob(current.status as JobStatus, parsed.data.status)) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id/status", method: "PATCH", adminKeyId, identifiers: { job_id: jobId.data }, success: false, errorCode: "INVALID_TRANSITION" });
    return fail("conflict", `Invalid transition from ${current.status} to ${parsed.data.status}.`, 409);
  }

  const { data, error } = await supabase
    .from("jobs")
    .update({
      status: parsed.data.status,
      completed_at: parsed.data.status === "completed" ? new Date().toISOString() : current.completed_at
    })
    .eq("id", jobId.data)
    .select("*")
    .single();

  if (error) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id/status", method: "PATCH", adminKeyId, identifiers: { job_id: jobId.data }, success: false, errorCode: "INTERNAL_ERROR" });
    return fail("internal_error", error.message, 500);
  }

  await supabase.from("job_status_logs").insert({
    job_id: jobId.data,
    from_status: current.status,
    to_status: parsed.data.status,
    memo: parsed.data.memo ?? null
  });

  const orderStatus = orderStatusForJob(parsed.data.status);
  if (orderStatus) {
    await supabase.from("orders").update({ status: orderStatus }).eq("id", current.order_id);
  }

  logOperation({ requestId, endpoint: "/api/admin/jobs/:id/status", method: "PATCH", adminKeyId, identifiers: { job_id: jobId.data, order_id: current.order_id }, success: true });
  return ok({ job: data, synced_order_status: orderStatus });
}
