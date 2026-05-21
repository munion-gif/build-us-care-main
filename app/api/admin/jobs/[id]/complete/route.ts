import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { insertJobStatusLog, invalidStatus, readJobOr404 } from "@/lib/jobs";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { completeJobSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id/complete", method: "PATCH", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }

  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to complete jobs.", 500);
  }

  const { id } = await context.params;
  const jobId = uuidSchema.safeParse(id);

  if (!jobId.success) {
    return validationError(jobId.error, "Invalid job id.");
  }

  const supabase = getSupabaseAdmin();
  const parsedBody = completeJobSchema.safeParse(await readJson(request));
  if (!parsedBody.success) {
    return validationError(parsedBody.error, "Invalid job completion request.");
  }
  const current = await readJobOr404(supabase, jobId.data);

  if (!current) {
    return fail("not_found", "Job not found.", 404);
  }

  if (current.status !== "in_progress") {
    return invalidStatus(current.status, "in_progress");
  }

  const completedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("jobs")
    .update({
      status: "done",
      completed_at: completedAt,
      ended_at: completedAt,
      actual_minutes: parsedBody.data.actual_minutes ?? null,
      materials_used: parsedBody.data.materials_used,
      extra_materials: parsedBody.data.extra_materials,
      completion_notes: parsedBody.data.completion_notes ?? null,
      issues: parsedBody.data.issues ?? null
    })
    .eq("id", jobId.data)
    .select("*")
    .single();

  if (error) {
    return fail("internal_error", error.message, 500);
  }

  await insertJobStatusLog(supabase, jobId.data, current.status, "done", "시공 완료");
  await supabase.from("orders").update({ status: "completed" }).eq("id", current.order_id);

  logOperation({ requestId, endpoint: "/api/admin/jobs/:id/complete", method: "PATCH", adminKeyId, identifiers: { job_id: jobId.data, order_id: current.order_id }, success: true });
  return ok({ job: data, synced_order_status: "completed" });
}
