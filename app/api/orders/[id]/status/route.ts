import { fail, ok } from "@/lib/api-response";
import { parseAdminKeys } from "@/lib/admin-auth";
import { EVENT_TYPES } from "@/lib/event-types";
import { inferDeviceType } from "@/lib/data-collection";
import { findReplacementProduct } from "@/lib/replacement-products";
import { ORDER_PHOTO_VIEW_EXPIRES_IN, ORDER_PHOTOS_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { accessTokenSchema, uuidSchema } from "@/lib/validation";
import { validationError } from "@/lib/errors";
import { isSchemaCompatibilityError } from "@/lib/schema-compat";

type Context = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

const ORDER_STATUS_SELECT = `
      id,
      order_number,
      status,
      is_test,
      service_type_code,
      source,
      campaign,
      channel,
      session_id,
      landing_path,
      device_type,
      region_code,
      skus,
      total_amount,
      online_payment_amount,
      onsite_payment_amount,
      onsite_payment_status,
      special_requests,
      access_token,
      created_at,
      customers (*),
      homes (*),
      quotes (*),
      jobs (*, technicians (id, name, phone, experience_years, specialties, bio, profile_image_url)),
      payments (*),
      media (*),
      feedbacks (*)
    `;
const ORDER_STATUS_SELECT_COMPAT = ORDER_STATUS_SELECT
  .replace("      is_test,\n", "")
  .replace("      online_payment_amount,\n      onsite_payment_amount,\n      onsite_payment_status,\n", "");

function hasValidAdminKey(request: Request) {
  const provided = request.headers.get("x-admin-key");
  return Boolean(provided && parseAdminKeys().includes(provided));
}

function maskPhone(phone: string | null | undefined) {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "*".repeat(phone.length);
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function maskName(name: string | null | undefined) {
  if (!name) return name;
  return `${name.slice(0, 1)}${"*".repeat(Math.max(name.length - 1, 1))}`;
}

function maskAddress(address: string | null | undefined) {
  if (!address) return address;
  if (/\S+호$/.test(address)) {
    return address.replace(/\S+호$/, "***호");
  }
  const parts = address.split(" ");
  if (parts.length <= 1) return "***";
  return `${parts.slice(0, -1).join(" ")} ***`;
}

function toArray(value: unknown) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function selectedProductSnapshot(metadata: any) {
  const product =
    metadata?.selected_replacement_product ??
    metadata?.selected_toilet_product ??
    metadata?.selected_replacement_product_snapshot;
  const productId =
    typeof metadata?.selected_replacement_product_id === "string"
      ? metadata.selected_replacement_product_id
      : typeof metadata?.selected_toilet_product_id === "string"
        ? metadata.selected_toilet_product_id
        : typeof product?.id === "string"
          ? product.id
          : null;
  const serviceCode =
    typeof metadata?.selected_replacement_product_service_code === "string"
      ? metadata.selected_replacement_product_service_code
      : typeof metadata?.service_type_code === "string"
        ? metadata.service_type_code
        : typeof product?.serviceCode === "string"
          ? product.serviceCode
          : null;
  const catalogProduct = serviceCode ? findReplacementProduct(serviceCode, productId) : null;

  if ((!product || typeof product !== "object") && !catalogProduct) return null;
  return {
    id: typeof product?.id === "string" ? product.id : catalogProduct?.id ?? null,
    serviceCode: typeof product?.serviceCode === "string" ? product.serviceCode : catalogProduct?.serviceCode ?? serviceCode,
    brand: typeof product?.brand === "string" ? product.brand : catalogProduct?.brand ?? null,
    model: typeof product?.model === "string" ? product.model : catalogProduct?.model ?? null,
    sku: typeof product?.sku === "string" ? product.sku : catalogProduct?.sku ?? null,
    price: typeof product?.price === "number" ? product.price : catalogProduct?.price ?? null,
    image: typeof product?.image === "string" ? product.image : catalogProduct?.image ?? null
  };
}

function sanitizeQuoteItems(items: unknown) {
  return toArray(items).map((item: any) => ({
    sku: item?.sku ?? null,
    item_name: item?.item_name ?? null,
    qty: item?.qty ?? 1,
    unit_material: item?.unit_material ?? 0,
    unit_labor: item?.unit_labor ?? 0,
    line_total: item?.line_total ?? 0,
    metadata: {
      selected_replacement_product: selectedProductSnapshot(item?.metadata)
    }
  }));
}

function sanitizeQuotes(quotes: any[] | null | undefined, isAdmin: boolean) {
  if (isAdmin) return quotes ?? [];
  return (quotes ?? []).map((quote) => ({
    id: quote.id,
    version: quote.version,
    total_final: quote.total_final,
    accepted_at: quote.accepted_at,
    quoted_at: quote.quoted_at,
    items: sanitizeQuoteItems(quote.items)
  }));
}

function sanitizePayments(payments: any[] | null | undefined, isAdmin: boolean) {
  if (isAdmin) return payments ?? [];
  return (payments ?? []).map((payment) => ({
    id: payment.id,
    provider: payment.provider,
    amount: payment.amount,
    product_amount: payment.product_amount,
    service_fee_amount: payment.service_fee_amount,
    total_amount: payment.total_amount,
    online_payment_amount: payment.online_payment_amount,
    onsite_payment_amount: payment.onsite_payment_amount,
    status: payment.status,
    paid_at: payment.paid_at,
    approved_at: payment.approved_at
  }));
}

function orderStatusQuery(supabase: ReturnType<typeof getSupabaseAdmin>, select: string, orderId: string, accessToken: string | null, isAdmin: boolean, includeLifecycleFilter = true) {
  let query = supabase
    .from("orders")
    .select(select)
    .eq("id", orderId);

  if (includeLifecycleFilter) {
    query = query.is("deleted_at", null);
  }

  if (!isAdmin) {
    query = query.eq("access_token", accessToken);
  }

  return query.single();
}

export async function GET(request: Request, context: Context) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to read order status.", 500);
  }

  const { id } = await context.params;
  const orderId = uuidSchema.safeParse(id);

  if (!orderId.success) {
    return validationError(orderId.error, "Invalid order id.");
  }

  const supabase = getSupabaseAdmin();
  const isAdmin = hasValidAdminKey(request);
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : null;
  const accessToken = bearerToken || new URL(request.url).searchParams.get("accessToken");

  if (!isAdmin) {
    const query = accessTokenSchema.safeParse(accessToken);
    if (!query.success) {
      return validationError(query.error, "Invalid or missing accessToken.");
    }
  }

  const initialResult = await orderStatusQuery(supabase, ORDER_STATUS_SELECT, orderId.data, accessToken, isAdmin);
  let data: any = initialResult.data;
  let error = initialResult.error;
  if (error && isSchemaCompatibilityError(error)) {
    const fallback = await orderStatusQuery(supabase, ORDER_STATUS_SELECT_COMPAT, orderId.data, accessToken, isAdmin, false);
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data) {
    return isAdmin
      ? fail("not_found", "Order not found.", 404)
      : fail("forbidden", "Access token is invalid for this order.", 403);
  }

  const signedMedia = await Promise.all(
    ((data.media ?? []) as any[]).map(async (photo: { id: string; file_path: string; sort_order: number; type: string; job_id?: string | null; order_id?: string | null }) => {
        const { data: signed } = await supabase.storage
          .from(ORDER_PHOTOS_BUCKET)
          .createSignedUrl(photo.file_path, ORDER_PHOTO_VIEW_EXPIRES_IN);

        return {
          id: photo.id,
          type: photo.type,
          job_id: photo.job_id ?? null,
          order_id: photo.order_id ?? null,
          file_path: photo.file_path,
          sort_order: photo.sort_order,
          viewUrl: signed?.signedUrl ?? null
        };
      }
    )
  );

  const { access_token: _accessToken, media: _media, customers, homes, quotes, payments, feedbacks, ...safeOrder } = data;
  const customer = Array.isArray(customers) ? customers[0] : customers;
  const home = Array.isArray(homes) ? homes[0] : homes;

  if (!isAdmin && data.is_test !== true) {
    await supabase.from("events").insert({
      event_type: EVENT_TYPES.STATUS_PAGE_VIEW,
      session_id: data.session_id ?? null,
      order_id: data.id,
      customer_id: customer?.id ?? null,
      source: data.source ?? data.channel ?? customer?.utm_source ?? null,
      campaign: data.campaign ?? customer?.utm_campaign ?? null,
      landing_path: data.landing_path ?? null,
      device_type: data.device_type ?? inferDeviceType(request.headers.get("user-agent")),
      service_code: data.service_type_code ?? data.skus?.[0]?.service_type_code ?? data.skus?.[0]?.sku ?? null,
      region_code: data.region_code ?? home?.address_dong ?? null,
      properties: { access: "customer_status_api" }
    });
  }

  return ok({
    order: {
      ...safeOrder,
      customer: isAdmin ? customer : { ...customer, phone: maskPhone(customer?.phone), name: maskName(customer?.name) },
      home: isAdmin ? home : { ...home, address_full: maskAddress(home?.address_full) },
      quotes: sanitizeQuotes(quotes, isAdmin),
      payments: sanitizePayments(payments, isAdmin),
      media: signedMedia,
      photos: signedMedia.filter((media: any) => media.type === "inquiry"),
      feedbacks: feedbacks ?? []
    }
  });
}
