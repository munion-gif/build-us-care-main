import { fail, ok } from "@/lib/api-response";
import { parseAdminKeys } from "@/lib/admin-auth";
import { matchLocalBuildusOrderFromRequest } from "@/lib/builduscare-local-order-server";
import { readJson, validationError } from "@/lib/errors";
import { getNextMediaSortOrder, storageUrlForPath } from "@/lib/media";
import { isOrderInquiryMediaPath } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { createOrderMediaSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

function hasValidAdminKey(request: Request) {
  const provided = request.headers.get("x-admin-key");
  return Boolean(provided && parseAdminKeys().includes(provided));
}

export async function POST(request: Request, context: Context) {
  if (!hasSupabaseEnv()) {
    const { id } = await context.params;
    const body = await readJson(request);
    const accessToken = typeof body?.accessToken === "string" ? body.accessToken : null;
    const localOrder = matchLocalBuildusOrderFromRequest(request, { orderId: id, accessToken });
    if (localOrder) {
      return fail("LOCAL_READ_ONLY", "로컬 확인 모드에서는 문의 사진 메타데이터를 저장하지 않습니다.", 409, { localMode: true });
    }
    return fail("not_found", "로컬 확인 모드에서 일치하는 주문을 찾을 수 없어요.", 404, { localMode: true });
  }

  const { id } = await context.params;
  const orderId = uuidSchema.safeParse(id);

  if (!orderId.success) {
    return validationError(orderId.error, "Invalid order id.");
  }

  const body = await readJson(request);
  const parsed = createOrderMediaSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid media metadata.");
  }

  if (!isOrderInquiryMediaPath(orderId.data, parsed.data.file_path)) {
    return fail("VALIDATION_ERROR", "Media file_path must start with the order inquiry media prefix.", 400, {
      file_path: parsed.data.file_path,
      expectedPrefix: `orders/${orderId.data}/inquiry/`
    });
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

  const sortOrder = await getNextMediaSortOrder(supabase, { order_id: orderId.data });
  const { data, error } = await supabase
    .from("media")
    .insert({
      order_id: orderId.data,
      job_id: null,
      type: "inquiry",
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

  const { data: existingOrder, error: orderPhotoLookupError } = await supabase
    .from("orders")
    .select("inquiry_photos")
    .eq("id", orderId.data)
    .single();

  if (orderPhotoLookupError) {
    return fail("internal_error", orderPhotoLookupError.message, 500);
  }

  const existingPhotos = Array.isArray(existingOrder?.inquiry_photos) ? existingOrder.inquiry_photos : [];
  const updatedPhotos = Array.from(new Set([...existingPhotos, data.file_path]));
  const { error: orderPhotoUpdateError } = await supabase.from("orders").update({ inquiry_photos: updatedPhotos }).eq("id", orderId.data);

  if (orderPhotoUpdateError) {
    return fail("internal_error", orderPhotoUpdateError.message, 500);
  }

  return ok({ media: data }, { status: 201 });
}
