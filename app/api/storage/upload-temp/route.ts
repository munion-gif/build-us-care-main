import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { readJson, validationError } from "@/lib/errors";
import { createDiagnosisTempPhotoPath, isAllowedPhotoContentType, ORDER_PHOTO_UPLOAD_EXPIRES_IN, ORDER_PHOTOS_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

const uploadTempSchema = z
  .object({
    fileName: z.string().min(1),
    contentType: z.string().min(1)
  })
  .strict();

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to create upload URLs.", 500);
  }

  const body = await readJson(request);
  const parsed = uploadTempSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid upload request.");
  }

  if (!isAllowedPhotoContentType(parsed.data.contentType)) {
    return fail("unsupported_media_type", "지원하지 않는 이미지 형식입니다.", 415);
  }

  const path = createDiagnosisTempPhotoPath(parsed.data.fileName, parsed.data.contentType);
  const { data, error } = await getSupabaseAdmin().storage.from(ORDER_PHOTOS_BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    return fail("internal_error", error?.message ?? "Failed to create signed upload URL.", 500);
  }

  return ok({
    uploadUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    expiresIn: ORDER_PHOTO_UPLOAD_EXPIRES_IN
  });
}
