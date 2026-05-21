import { fail, ok } from "@/lib/api-response";
import { parseAdminKeys } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { isOrderPhotoPath } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uploadPhotosSchema, uuidSchema } from "@/lib/validation";
import { getNextMediaSortOrder, storageUrlForPath } from "@/lib/media";

type Context = {
  params: Promise<{ id: string }>;
};

function hasValidAdminKey(request: Request) {
  const provided = request.headers.get("x-admin-key");
  return Boolean(provided && parseAdminKeys().includes(provided));
}

export async function POST(request: Request, context: Context) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to store photo metadata.", 500);
  }

  const { id } = await context.params;
  const orderId = uuidSchema.safeParse(id);

  if (!orderId.success) {
    return validationError(orderId.error, "Invalid order id.");
  }

  const body = await readJson(request);
  const parsed = uploadPhotosSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid photo metadata.");
  }

  const invalidPhoto = parsed.data.photos.find((photo) => !isOrderPhotoPath(orderId.data, photo.file_path));

  if (invalidPhoto) {
    return fail("VALIDATION_ERROR", "Photo file_path must start with the order photo prefix.", 400, {
      file_path: invalidPhoto.file_path,
      expectedPrefix: `orders/${orderId.data}/`
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

  const inserted = [];

  for (const photo of parsed.data.photos) {
    const sortOrder = photo.sort_order || (await getNextMediaSortOrder(supabase, { order_id: orderId.data }));
    const { data, error } = await supabase
      .from("media")
      .insert({
        order_id: orderId.data,
        job_id: null,
        type: "inquiry",
        url: storageUrlForPath(photo.file_path),
        file_path: photo.file_path,
        sort_order: sortOrder
      })
      .select("*")
      .single();

    if (error) {
      return fail("internal_error", error.message, 500);
    }

    inserted.push(data);
  }

  return ok({ photos: inserted }, { status: 201 });
}
