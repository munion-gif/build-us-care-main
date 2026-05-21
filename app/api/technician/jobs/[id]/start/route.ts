import { fail, ok } from "@/lib/api-response";
import { readJson, validationError } from "@/lib/errors";
import { insertJobStatusLog, invalidStatus } from "@/lib/jobs";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { readTechnicianJobOrForbidden, requireTechnician } from "@/lib/technician-auth";
import { startJobSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { id } = await context.params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return validationError(parsed.error, "Invalid job id.");

  const parsedBody = startJobSchema.safeParse(await readJson(request));
  if (!parsedBody.success) return validationError(parsedBody.error, "Invalid job start request.");

  const supabase = getSupabaseAdmin();
  const { technician, response } = await requireTechnician(supabase, request);
  if (response) return response;

  const current = await readTechnicianJobOrForbidden(supabase, parsed.data, technician.id);
  if (!current) return fail("not_found", "Job not found.", 404);
  if (current.status !== "scheduled") return invalidStatus(current.status, "scheduled");

  const startedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("jobs")
    .update({
      status: "in_progress",
      started_at: startedAt,
      ...(parsedBody.data.expected_minutes !== undefined ? { expected_minutes: parsedBody.data.expected_minutes } : {})
    })
    .eq("id", parsed.data)
    .eq("technician_id", technician.id)
    .select("*")
    .single();

  if (error) return fail("internal_error", error.message, 500);

  await insertJobStatusLog(supabase, parsed.data, current.status, "in_progress", "기사 앱 시공 시작");
  await supabase.from("orders").update({ status: "in_progress" }).eq("id", current.order_id);

  return ok({ job: data, synced_order_status: "in_progress" });
}
