import { fail, ok } from "@/lib/api-response";
import { parseAdminKeys } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { createOrderInquiryMediaPath, ORDER_PHOTO_UPLOAD_EXPIRES_IN, ORDER_PHOTOS_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { createOrderMediaUploadUrlSchema, uuidSchema } from "@/lib/validation";

const ORDER_MEDIA_UPLOAD_URL_LIMIT = 10;
const ORDER_MEDIA_UPLOAD_URL_WINDOW_MS = 10 * 60 * 1000;

type Context = {
  params: Promise<{ id: string }>;
};

function hasValidAdminKey(request: Request) {
  const provided = request.headers.get("x-admin-key");
  return Boolean(provided && parseAdminKeys().includes(provided));
}

export async function POST(request: Request, context: Context) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to create media upload URLs.", 500);
  }

  const { id } = await context.params;
  const orderId = uuidSchema.safeParse(id);

  if (!orderId.success) {
    return validationError(orderId.error, "Invalid order id.");
  }

  const rateLimit = checkRateLimit(`order-media-upload-url:${getClientIp(request.headers)}:${orderId.data}`, {
    limit: ORDER_MEDIA_UPLOAD_URL_LIMIT,
    windowMs: ORDER_MEDIA_UPLOAD_URL_WINDOW_MS
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds, "문의 업로드 요청이 많습니다. 잠시 후 다시 시도해주세요.");
  }

  const body = await readJson(request);
  const parsed = createOrderMediaUploadUrlSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid upload URL request.");
  }

  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase
    .from("orders")
    .select("id,access_token")
    .eq("id", orderId.data)
    .maybeSingle();

  if (!order) {
    return fail("not_found", "Order not found.", 404);
  }

  const isGuest = parsed.data.accessToken && parsed.data.accessToken === order.access_token;
  const isAdmin = hasValidAdminKey(request);

  if (!isGuest && !isAdmin) {
    return fail("forbidden", "A valid accessToken or admin key is required.", 403);
  }

  const filePath = createOrderInquiryMediaPath(orderId.data, parsed.data.fileName, parsed.data.contentType);
  const { data, error } = await supabase.storage.from(ORDER_PHOTOS_BUCKET).createSignedUploadUrl(filePath);

  if (error || !data) {
    return fail("internal_error", error?.message ?? "Failed to create signed upload URL.", 500);
  }

  return ok({
    uploadUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    type: "inquiry",
    expiresIn: ORDER_PHOTO_UPLOAD_EXPIRES_IN
  });
}
