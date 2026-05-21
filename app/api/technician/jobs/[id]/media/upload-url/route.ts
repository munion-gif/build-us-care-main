import { fail, ok } from "@/lib/api-response";
import { readJson, validationError } from "@/lib/errors";
import { createJobMediaPath, ORDER_PHOTO_UPLOAD_EXPIRES_IN, ORDER_PHOTOS_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { readTechnicianJobOrForbidden, requireTechnician } from "@/lib/technician-auth";
import { createJobMediaUploadUrlSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: Context) {
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { id } = await context.params;
  const parsedJobId = uuidSchema.safeParse(id);
  if (!parsedJobId.success) return validationError(parsedJobId.error, "Invalid job id.");

  const parsed = createJobMediaUploadUrlSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error, "Invalid upload URL request.");

  const supabase = getSupabaseAdmin();
  const { technician, response } = await requireTechnician(supabase, request);
  if (response) return response;

  const job = await readTechnicianJobOrForbidden(supabase, parsedJobId.data, technician.id);
  if (!job) return fail("not_found", "Job not found.", 404);

  const filePath = createJobMediaPath(parsedJobId.data, parsed.data.type, parsed.data.fileName, parsed.data.contentType);
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
