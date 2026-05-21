import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { assignJobSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id/assign", method: "PATCH", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }

  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to assign jobs.", 500);
  }

  const { id } = await context.params;
  const jobId = uuidSchema.safeParse(id);

  if (!jobId.success) {
    return validationError(jobId.error, "Invalid job id.");
  }

  const body = await readJson(request);
  const parsed = assignJobSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid job assignment request.");
  }

  const supabase = getSupabaseAdmin();
  const { data: current, error: readError } = await supabase.from("jobs").select("*").eq("id", jobId.data).single();

  if (readError || !current) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id/assign", method: "PATCH", adminKeyId, identifiers: { job_id: jobId.data }, success: false, errorCode: "NOT_FOUND" });
    return fail("not_found", "Job not found.", 404);
  }

  const nextStatus = parsed.data.scheduled_date ? "scheduled" : "assigned";
  const { data, error } = await supabase
    .from("jobs")
    .update({
      assigned_technician_name: parsed.data.assigned_technician_name,
      scheduled_date: parsed.data.scheduled_date ?? current.scheduled_date,
      status: nextStatus
    })
    .eq("id", jobId.data)
    .select("*")
    .single();

  if (error) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id/assign", method: "PATCH", adminKeyId, identifiers: { job_id: jobId.data }, success: false, errorCode: "INTERNAL_ERROR" });
    return fail("internal_error", error.message, 500);
  }

  await supabase.from("job_status_logs").insert({
    job_id: jobId.data,
    from_status: current.status,
    to_status: nextStatus,
    memo: `${parsed.data.assigned_technician_name} 배정`
  });

  logOperation({ requestId, endpoint: "/api/admin/jobs/:id/assign", method: "PATCH", adminKeyId, identifiers: { job_id: jobId.data, order_id: current.order_id }, success: true });
  return ok({ job: data });
}
