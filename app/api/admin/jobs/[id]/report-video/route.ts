import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { reportVideoSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: Context) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id/report-video", method: "POST", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }

  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to save report videos.", 500);
  }

  const { id } = await context.params;
  const jobId = uuidSchema.safeParse(id);

  if (!jobId.success) {
    return validationError(jobId.error, "Invalid job id.");
  }

  const body = await readJson(request);
  const parsed = reportVideoSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid report video request.");
  }

  const supabase = getSupabaseAdmin();
  const { data: current } = await supabase.from("jobs").select("*").eq("id", jobId.data).single();

  if (!current) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id/report-video", method: "POST", adminKeyId, identifiers: { job_id: jobId.data }, success: false, errorCode: "NOT_FOUND" });
    return fail("not_found", "Job not found.", 404);
  }

  const { data, error } = await supabase
    .from("jobs")
    .update({
      report_video_url: parsed.data.report_video_url,
      status: "completed",
      completed_at: new Date().toISOString()
    })
    .eq("id", jobId.data)
    .select("*")
    .single();

  if (error) {
    logOperation({ requestId, endpoint: "/api/admin/jobs/:id/report-video", method: "POST", adminKeyId, identifiers: { job_id: jobId.data }, success: false, errorCode: "INTERNAL_ERROR" });
    return fail("internal_error", error.message, 500);
  }

  await supabase.from("job_status_logs").insert({
    job_id: jobId.data,
    from_status: current.status,
    to_status: "completed",
    memo: "완료 보고 영상 등록"
  });

  await supabase.from("orders").update({ status: "completed" }).eq("id", current.order_id);

  await supabase.from("notifications").insert({
    order_id: current.order_id,
    job_id: jobId.data,
    channel: "mock",
    template_code: "report_video_ready",
    recipient: "customer",
    send_status: "queued",
    payload: { report_video_url: parsed.data.report_video_url }
  });

  logOperation({ requestId, endpoint: "/api/admin/jobs/:id/report-video", method: "POST", adminKeyId, identifiers: { job_id: jobId.data, order_id: current.order_id }, success: true });
  return ok({ job: data });
}
