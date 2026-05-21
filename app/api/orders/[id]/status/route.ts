import { fail, ok } from "@/lib/api-response";
import { parseAdminKeys } from "@/lib/admin-auth";
import { EVENT_TYPES } from "@/lib/event-types";
import { inferDeviceType } from "@/lib/data-collection";
import { ORDER_PHOTO_VIEW_EXPIRES_IN, ORDER_PHOTOS_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { accessTokenSchema, uuidSchema } from "@/lib/validation";
import { validationError } from "@/lib/errors";

type Context = {
  params: Promise<{ id: string }>;
};

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

function sanitizeQuotes(quotes: any[] | null | undefined, isAdmin: boolean) {
  if (isAdmin) return quotes ?? [];
  return (quotes ?? []).map((quote) => ({
    id: quote.id,
    version: quote.version,
    total_final: quote.total_final,
    accepted_at: quote.accepted_at,
    quoted_at: quote.quoted_at
  }));
}

function sanitizePayments(payments: any[] | null | undefined, isAdmin: boolean) {
  if (isAdmin) return payments ?? [];
  return (payments ?? []).map((payment) => ({
    id: payment.id,
    provider: payment.provider,
    amount: payment.amount,
    status: payment.status,
    paid_at: payment.paid_at,
    approved_at: payment.approved_at
  }));
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

  const { data: exists } = await supabase.from("orders").select("id").eq("id", orderId.data).maybeSingle();

  if (!exists) {
    return fail("not_found", "Order not found.", 404);
  }

  let query = supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      status,
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
      access_token,
      created_at,
      customers (*),
      homes (*),
      quotes (*),
      reservations (*),
      jobs (*, technicians (id, name, phone, experience_years, specialties, bio, profile_image_url)),
      payments (*),
      media (*),
      feedbacks (*)
    `
    )
    .eq("id", orderId.data);

  if (!isAdmin) {
    query = query.eq("access_token", accessToken);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return isAdmin
      ? fail("not_found", "Order not found.", 404)
      : fail("forbidden", "Access token is invalid for this order.", 403);
  }

  const signedMedia = await Promise.all(
    (data.media ?? []).map(async (photo: { id: string; file_path: string; sort_order: number; type: string; job_id?: string | null; order_id?: string | null }) => {
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

  if (!isAdmin) {
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
      photos: signedMedia.filter((media) => media.type === "inquiry"),
      feedbacks: feedbacks ?? []
    }
  });
}
