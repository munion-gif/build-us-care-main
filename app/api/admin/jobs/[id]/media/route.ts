import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { getNextMediaSortOrder, storageUrlForPath } from "@/lib/media";
import { isJobMediaPath } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { createJobMediaSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: Context) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to store media metadata.", 500);
  }

  const authError = requireAdmin(request);
  if (authError) return authError;

  const { id } = await context.params;
  const jobId = uuidSchema.safeParse(id);

  if (!jobId.success) {
    return validationError(jobId.error, "Invalid job id.");
  }

  const body = await readJson(request);
  const parsed = createJobMediaSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid media metadata.");
  }

  if (!isJobMediaPath(jobId.data, parsed.data.type, parsed.data.file_path)) {
    return fail("VALIDATION_ERROR", "Media file_path must start with the job media prefix.", 400, {
      file_path: parsed.data.file_path,
      expectedPrefix: `jobs/${jobId.data}/${parsed.data.type}/`
    });
  }

  const supabase = getSupabaseAdmin();
  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId.data).maybeSingle();

  if (!job) {
    return fail("not_found", "Job not found.", 404);
  }

  const sortOrder = await getNextMediaSortOrder(supabase, { job_id: jobId.data });
  const { data, error } = await supabase
    .from("media")
    .insert({
      order_id: null,
      job_id: jobId.data,
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

  if (error) {
    return fail("internal_error", error.message, 500);
  }

  return ok({ media: data }, { status: 201 });
}
