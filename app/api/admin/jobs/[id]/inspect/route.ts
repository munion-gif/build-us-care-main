import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { insertJobStatusLog, invalidStatus, readJobOr404 } from "@/lib/jobs";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { inspectJobSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id/inspect", method: "PATCH", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }

  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to inspect jobs.", 500);
  }

  const { id } = await context.params;
  const jobId = uuidSchema.safeParse(id);

  if (!jobId.success) {
    return validationError(jobId.error, "Invalid job id.");
  }

  const body = await readJson(request);
  const parsed = inspectJobSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid inspection request.");
  }

  const supabase = getSupabaseAdmin();
  const current = await readJobOr404(supabase, jobId.data);

  if (!current) {
    return fail("not_found", "Job not found.", 404);
  }

  if (current.status !== "done") {
    return invalidStatus(current.status, "done");
  }

  const inspectedAt = new Date().toISOString();
  const { data: inspection, error: inspectionError } = await supabase
    .from("inspections")
    .insert({
      job_id: jobId.data,
      passed: parsed.data.passed,
      checklist_results: parsed.data.checklist_results,
      issues_found: parsed.data.passed ? null : parsed.data.inspector_note ?? null,
      inspector_note: parsed.data.inspector_note ?? null,
      inspected_at: inspectedAt,
      inspected_by: adminKeyId
    })
    .select("*")
    .single();

  if (inspectionError) {
    return fail("internal_error", inspectionError.message, 500);
  }

  const orderStatus = parsed.data.passed ? "done" : "issue";
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .update({ status: "inspected", inspected_at: inspectedAt })
    .eq("id", jobId.data)
    .select("*")
    .single();

  if (jobError) {
    return fail("internal_error", jobError.message, 500);
  }

  await insertJobStatusLog(supabase, jobId.data, current.status, "inspected", parsed.data.passed ? "검수 통과" : "검수 이슈");
  await supabase.from("orders").update({ status: orderStatus }).eq("id", current.order_id);

  logOperation({ requestId, endpoint: "/api/admin/jobs/:id/inspect", method: "PATCH", adminKeyId, identifiers: { job_id: jobId.data, order_id: current.order_id }, success: true });
  return ok({ job, inspection, synced_order_status: orderStatus });
}
