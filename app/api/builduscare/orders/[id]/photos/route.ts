import { fail, ok } from "@/lib/api-response";
import {
  attachBuilduscareOrderPhotos,
  builduscarePhotoFiles,
  upsertBuilduscarePhotoDiagnosis
} from "@/lib/builduscare-photo-processing";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { accessTokenSchema, uuidSchema } from "@/lib/validation";
import { validationError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHOTO_UPLOAD_LIMIT = 8;
const PHOTO_UPLOAD_WINDOW_MS = 10 * 60 * 1000;

type Context = {
  params: Promise<{ id: string }>;
};

function firstRelated(value: unknown): any {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function orderItemName(order: any) {
  const firstSku = Array.isArray(order?.skus) ? order.skus[0] : null;
  const itemName = typeof firstSku?.item_name === "string" ? firstSku.item_name : "";
  return itemName || "사진 확인";
}

export async function POST(request: Request, context: Context) {
  if (!hasSupabaseEnv()) {
    return fail("LOCAL_READ_ONLY", "로컬 확인 모드에서는 Build us Care 사진 업로드를 저장하지 않습니다.", 409, { localMode: true });
  }

  const { id } = await context.params;
  const orderId = uuidSchema.safeParse(id);
  if (!orderId.success) {
    return validationError(orderId.error, "Invalid order id.");
  }

  const rateLimit = checkRateLimit(`builduscare-photo-upload:${getClientIp(request.headers)}:${orderId.data}`, {
    limit: PHOTO_UPLOAD_LIMIT,
    windowMs: PHOTO_UPLOAD_WINDOW_MS
  });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds, "사진 업로드 요청이 많습니다. 잠시 후 다시 시도해주세요.");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("BAD_REQUEST", "사진 업로드 정보를 다시 확인해주세요.", 400);
  }

  const accessToken = accessTokenSchema.safeParse(String(formData.get("accessToken") ?? ""));
  if (!accessToken.success) {
    return validationError(accessToken.error, "A valid accessToken is required.");
  }

  const photoFiles = builduscarePhotoFiles(formData);
  if (photoFiles.length === 0) {
    return ok({ photoCount: 0, diagnosisId: null });
  }

  const supabase = getSupabaseAdmin();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      access_token,
      service_type_code,
      reason,
      skus,
      customers (name, phone),
      homes (address_full, address_apt, postal_code)
    `)
    .eq("id", orderId.data)
    .maybeSingle();

  if (orderError) return fail("internal_error", orderError.message, 500);
  if (!order) return fail("not_found", "Order not found.", 404);
  if (order.access_token !== accessToken.data) {
    return fail("forbidden", "A valid accessToken is required.", 403);
  }

  try {
    const photoPaths = await attachBuilduscareOrderPhotos(order.id, photoFiles);
    const customer = firstRelated(order.customers);
    const home = firstRelated(order.homes);
    const isPhotoCheck = order.reason === "photo_check_request" || order.service_type_code === "photo_inquiry";
    const diagnosis = isPhotoCheck
      ? await upsertBuilduscarePhotoDiagnosis({
          orderId: order.id,
          orderNumber: order.order_number,
          serviceCode: order.service_type_code || "photo_inquiry",
          photoPaths,
          name: typeof customer?.name === "string" ? customer.name : "",
          phone: typeof customer?.phone === "string" ? customer.phone : "",
          roadAddress: typeof home?.address_full === "string" ? home.address_full : "",
          detailAddress: typeof home?.address_apt === "string" ? home.address_apt : "",
          postalCode: typeof home?.postal_code === "string" ? home.postal_code : "",
          item: orderItemName(order)
        })
      : null;

    return ok({
      photoCount: photoPaths.length,
      diagnosisId: diagnosis?.id ?? null
    }, { status: 201 });
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "사진 업로드에 실패했습니다.", 500);
  }
}
