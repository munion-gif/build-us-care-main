import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { insertJobStatusLog, invalidStatus, readJobOr404 } from "@/lib/jobs";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { startJobSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id/start", method: "PATCH", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }

  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to start jobs.", 500);
  }

  const { id } = await context.params;
  const jobId = uuidSchema.safeParse(id);

  if (!jobId.success) {
    return validationError(jobId.error, "Invalid job id.");
  }

  const supabase = getSupabaseAdmin();
  const parsedBody = startJobSchema.safeParse(await readJson(request));
  if (!parsedBody.success) {
    return validationError(parsedBody.error, "Invalid job start request.");
  }
  const current = await readJobOr404(supabase, jobId.data);

  if (!current) {
    return fail("not_found", "Job not found.", 404);
  }

  if (current.status !== "scheduled") {
    return invalidStatus(current.status, "scheduled");
  }

  const startedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("jobs")
    .update({ status: "in_progress", started_at: startedAt, ...(parsedBody.data.expected_minutes !== undefined ? { expected_minutes: parsedBody.data.expected_minutes } : {}) })
    .eq("id", jobId.data)
    .select("*")
    .single();

  if (error) {
    return fail("internal_error", error.message, 500);
  }

  await insertJobStatusLog(supabase, jobId.data, current.status, "in_progress", "시공 시작");
  await supabase.from("orders").update({ status: "in_progress" }).eq("id", current.order_id);

  logOperation({ requestId, endpoint: "/api/admin/jobs/:id/start", method: "PATCH", adminKeyId, identifiers: { job_id: jobId.data, order_id: current.order_id }, success: true });
  return ok({ job: data, synced_order_status: "in_progress" });
}
