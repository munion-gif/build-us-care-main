import { fail, ok } from "@/lib/api-response";
import { readJson, validationError } from "@/lib/errors";
import { insertJobStatusLog, invalidStatus } from "@/lib/jobs";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { readTechnicianJobOrForbidden, requireTechnician } from "@/lib/technician-auth";
import { completeJobSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { id } = await context.params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return validationError(parsed.error, "Invalid job id.");

  const parsedBody = completeJobSchema.safeParse(await readJson(request));
  if (!parsedBody.success) return validationError(parsedBody.error, "Invalid job completion request.");

  const supabase = getSupabaseAdmin();
  const { technician, response } = await requireTechnician(supabase, request);
  if (response) return response;

  const current = await readTechnicianJobOrForbidden(supabase, parsed.data, technician.id);
  if (!current) return fail("not_found", "Job not found.", 404);
  if (current.status !== "in_progress") return invalidStatus(current.status, "in_progress");

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
    .eq("id", parsed.data)
    .eq("technician_id", technician.id)
    .select("*")
    .single();

  if (error) return fail("internal_error", error.message, 500);

  await insertJobStatusLog(supabase, parsed.data, current.status, "done", "기사 앱 완료 보고");
  await supabase.from("orders").update({ status: "completed" }).eq("id", current.order_id);

  return ok({ job: data, synced_order_status: "completed" });
}
