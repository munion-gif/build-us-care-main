import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { createJobMediaPath, ORDER_PHOTO_UPLOAD_EXPIRES_IN, ORDER_PHOTOS_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { createJobMediaUploadUrlSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: Context) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to create media upload URLs.", 500);
  }

  const authError = requireAdmin(request);
  if (authError) return authError;

  const { id } = await context.params;
  const jobId = uuidSchema.safeParse(id);

  if (!jobId.success) {
    return validationError(jobId.error, "Invalid job id.");
  }

  const body = await readJson(request);
  const parsed = createJobMediaUploadUrlSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid upload URL request.");
  }

  const supabase = getSupabaseAdmin();
  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId.data).maybeSingle();

  if (!job) {
    return fail("not_found", "Job not found.", 404);
  }

  const filePath = createJobMediaPath(jobId.data, parsed.data.type, parsed.data.fileName, parsed.data.contentType);
  const { data, error } = await supabase.storage.from(ORDER_PHOTOS_BUCKET).createSignedUploadUrl(filePath);

  if (error || !data) {
    return fail("internal_error", error?.message ?? "Failed to create signed upload URL.", 500);
  }

  return ok({
    uploadUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    file_path: data.path,
    type: parsed.data.type,
    expiresIn: ORDER_PHOTO_UPLOAD_EXPIRES_IN
  });
}
