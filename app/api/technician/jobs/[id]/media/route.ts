import { fail, ok } from "@/lib/api-response";
import { readJson, validationError } from "@/lib/errors";
import { getNextMediaSortOrder, storageUrlForPath } from "@/lib/media";
import { isJobMediaPath } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { readTechnicianJobOrForbidden, requireTechnician } from "@/lib/technician-auth";
import { createJobMediaSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: Context) {
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { id } = await context.params;
  const parsedJobId = uuidSchema.safeParse(id);
  if (!parsedJobId.success) return validationError(parsedJobId.error, "Invalid job id.");

  const parsed = createJobMediaSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error, "Invalid media metadata.");

  if (!isJobMediaPath(parsedJobId.data, parsed.data.type, parsed.data.file_path)) {
    return fail("VALIDATION_ERROR", "Media file_path must start with the job media prefix.", 400);
  }

  const supabase = getSupabaseAdmin();
  const { technician, response } = await requireTechnician(supabase, request);
  if (response) return response;

  const job = await readTechnicianJobOrForbidden(supabase, parsedJobId.data, technician.id);
  if (!job) return fail("not_found", "Job not found.", 404);

  const sortOrder = await getNextMediaSortOrder(supabase, { job_id: parsedJobId.data });
  const { data, error } = await supabase
    .from("media")
    .insert({
      order_id: null,
      job_id: parsedJobId.data,
      type: parsed.data.type,
      url: parsed.data.url ?? storageUrlForPath(parsed.data.file_path),
      file_path: parsed.data.file_path,
      angle: parsed.data.angle ?? null,
      tags: parsed.data.tags,
      ai_detected: parsed.data.ai_detected ?? null,
      sort_order: sortOrder
    })
    .select("*")
    .single();

  if (error) return fail("internal_error", error.message, 500);

  return ok({ media: data }, { status: 201 });
}
