import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { readJson, validationError } from "@/lib/errors";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { createDiagnosisTempPhotoPath, isAllowedPhotoContentType, MAX_PHOTO_UPLOAD_BYTES, ORDER_PHOTO_UPLOAD_EXPIRES_IN, ORDER_PHOTOS_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

const TEMP_UPLOAD_URL_LIMIT = 12;
const TEMP_UPLOAD_URL_WINDOW_MS = 10 * 60 * 1000;

const uploadTempSchema = z
  .object({
    fileName: z.string().min(1),
    contentType: z.string().min(1),
    fileSize: z.number().int().positive().max(MAX_PHOTO_UPLOAD_BYTES).optional()
  })
  .strict();

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to create upload URLs.", 500);
  }

  const rateLimit = checkRateLimit(`temp-upload-url:${getClientIp(request.headers)}`, {
    limit: TEMP_UPLOAD_URL_LIMIT,
    windowMs: TEMP_UPLOAD_URL_WINDOW_MS
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds, "사진 업로드 요청이 많습니다. 잠시 후 다시 시도해주세요.");
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
