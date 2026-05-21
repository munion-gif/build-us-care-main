import { fail, ok } from "@/lib/api-response";
import { parseAddressApt, parseAddressDong } from "@/lib/address-parse";
import { inferDeviceType, normalizeCampaign, normalizeSource } from "@/lib/data-collection";
import { EVENT_TYPES } from "@/lib/event-types";
import { readJson, validationError } from "@/lib/errors";
import { notifyNewOrder } from "@/lib/notify-admin";
import { createOrderDateKey, createOrderNumber } from "@/lib/orders";
import { calculateQuote } from "@/lib/quote";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { createOrderSchema } from "@/lib/validation";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

function compactAddress(address: { road_address: string; detail_address?: string }) {
  return [address.road_address, address.detail_address].filter(Boolean).join(" ").trim();
}

function inferAddressDong(addressFull: string) {
  const tokens = addressFull.split(/\s+/).filter(Boolean);
  return tokens.find((token) => /동$|읍$|면$|리$/.test(token)) ?? tokens.slice(0, 3).join(" ") ?? "unknown";
}

function buildSkuSnapshot(items: Array<{ service_type_code?: string; qty: number; options?: unknown[]; metadata?: Record<string, unknown> }>) {
  return items.map((item) => ({
    sku: item.service_type_code ?? item.metadata?.service_type_code ?? "unknown",
    qty: item.qty,
    service_type: "labor_service",
    options: item.options ?? [],
    material_skus: []
  }));
}

async function createSequentialOrderNumber(supabase: SupabaseAdmin) {
  const dateKey = createOrderDateKey();
  const prefix = `BO-${dateKey}-`;

  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .like("order_number", `${prefix}%`);

  if (error) {
    throw new Error(error.message);
  }

  return createOrderNumber(new Date(), (count ?? 0) + 1);
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to create orders.", 500);
  }

  const body = await readJson(request);
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid order request.");
  }

  const supabase = getSupabaseAdmin();
  const quote = calculateQuote(parsed.data.items, parsed.data.visit_fee);
  const addressFull = parsed.data.home?.address_full ?? compactAddress(parsed.data.address);
  const parsedAddressDong = parseAddressDong(addressFull);
  const parsedAddressApt = parseAddressApt(addressFull);
  const addressDong = parsedAddressDong ?? parsedAddressApt ?? parsed.data.home?.address_dong ?? inferAddressDong(addressFull);
  const addressApt = parsedAddressApt ?? parsed.data.home?.address_apt ?? "";
  const postalCode = parsed.data.home?.postal_code ?? parsed.data.address.postal_code;
  const housingType = parsed.data.home?.housing_type ?? "unknown";
  const orderInput = parsed.data.order;
  const channel = orderInput?.channel ?? parsed.data.channel ?? "web";
  const source = normalizeSource(parsed.data.utm_source ?? channel);
  const campaign = normalizeCampaign(parsed.data.utm_campaign);
  const deviceType = parsed.data.device_type ?? inferDeviceType(request.headers.get("user-agent"));
  const reason = orderInput?.reason ?? parsed.data.reason ?? "unknown";
  const urgency = orderInput?.urgency ?? parsed.data.urgency ?? "flexible";
  const selfDiagnosis = orderInput?.self_diagnosis ?? parsed.data.self_diagnosis ?? parsed.data.special_requests ?? null;
  const skus = orderInput?.skus ?? buildSkuSnapshot(parsed.data.items);

  const customerSnapshot = {
    name: parsed.data.customer.name ?? null,
    acquisition_source: parsed.data.customer.acquisition_source,
    address_full: addressFull,
    address_dong: addressDong,
    address_apt: addressApt,
    housing_type: housingType,
    household_size: parsed.data.customer.household_size ?? null,
    has_kids: parsed.data.customer.has_kids ?? null,
    has_elderly: parsed.data.customer.has_elderly ?? null,
    utm_source: parsed.data.customer.utm_source ?? parsed.data.utm_source ?? null,
    utm_campaign: parsed.data.customer.utm_campaign ?? parsed.data.utm_campaign ?? null,
    utm_medium: parsed.data.customer.utm_medium ?? parsed.data.utm_medium ?? null,
    referrer_url: parsed.data.customer.referrer_url ?? parsed.data.referrer_url ?? null
  };

  const { data: existingCustomer, error: customerLookupError } = await supabase
    .from("customers")
    .select("*")
    .eq("phone", parsed.data.customer.phone)
    .maybeSingle();

  if (customerLookupError) {
    return fail("internal_error", customerLookupError.message, 500);
  }

  let customer = existingCustomer;
  if (customer) {
    const updateSnapshot = Object.fromEntries(
      Object.entries(customerSnapshot).filter(([, value]) => value !== null && value !== undefined && value !== "")
    );
    const { data: updatedCustomer, error: customerUpdateError } = await supabase
      .from("customers")
      .update(updateSnapshot)
      .eq("id", customer.id)
      .select("*")
      .single();

    if (customerUpdateError) {
      return fail("internal_error", customerUpdateError.message, 500);
    }

    customer = updatedCustomer;
  } else {
    const { data: insertedCustomer, error: customerInsertError } = await supabase
      .from("customers")
      .insert({
        phone: parsed.data.customer.phone,
        ...customerSnapshot
      })
      .select("*")
      .single();

    if (customerInsertError) {
      return fail("internal_error", customerInsertError.message, 500);
    }

    customer = insertedCustomer;
  }

  const { data: existingHome, error: existingHomeError } = await supabase
    .from("homes")
    .select("*")
    .eq("customer_id", customer.id)
    .eq("address_full", addressFull)
    .maybeSingle();

  if (existingHomeError) {
    return fail("internal_error", existingHomeError.message, 500);
  }

  let home = existingHome;
  if (!home) {
    const { data: insertedHome, error: homeError } = await supabase
      .from("homes")
      .insert({
        customer_id: customer.id,
        address_full: addressFull,
        address_dong: addressDong,
        address_apt: addressApt || null,
        postal_code: postalCode || null,
        size_pyung: parsed.data.home?.size_pyung ?? 0,
        building_type: parsed.data.home?.building_type ?? "unknown",
        year_built: parsed.data.home?.year_built ?? null,
        floor: parsed.data.home?.floor ?? null,
        complex_id: parsed.data.home?.complex_id ?? null
      })
      .select("*")
      .single();

    if (homeError) {
      return fail("internal_error", homeError.message, 500);
    }

    home = insertedHome;
  } else {
    const homePatch: Record<string, unknown> = {};
    const requestedHome = parsed.data.home;

    if (postalCode) homePatch.postal_code = postalCode;
    if (addressDong && addressDong !== "unknown") homePatch.address_dong = addressDong;
    if (addressApt) homePatch.address_apt = addressApt;
    if (requestedHome?.building_type && requestedHome.building_type !== "unknown") homePatch.building_type = requestedHome.building_type;
    if (requestedHome?.size_pyung && requestedHome.size_pyung > 0) homePatch.size_pyung = requestedHome.size_pyung;
    if (requestedHome?.year_built) homePatch.year_built = requestedHome.year_built;
    if (requestedHome?.floor) homePatch.floor = requestedHome.floor;
    if (requestedHome?.complex_id) homePatch.complex_id = requestedHome.complex_id;

    if (Object.keys(homePatch).length > 0) {
      const { data: updatedHome, error: homeUpdateError } = await supabase.from("homes").update(homePatch).eq("id", home.id).select("*").single();

      if (homeUpdateError) {
        return fail("internal_error", homeUpdateError.message, 500);
      }

      home = updatedHome;
    }
  }

  let orderNumber: string;
  try {
    orderNumber = await createSequentialOrderNumber(supabase);
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Failed to create order number.", 500);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_id: customer.id,
      home_id: home.id,
      status: "inquiry",
      skus,
      channel,
      source,
      campaign,
      session_id: parsed.data.session_id ?? null,
      landing_path: parsed.data.landing_path ?? null,
      device_type: deviceType,
      region_code: parsed.data.region_code ?? parsed.data.home?.address_dong ?? null,
      reason,
      urgency,
      self_diagnosis: selfDiagnosis,
      service_type_code: parsed.data.service_type_code ?? parsed.data.items[0]?.service_type_code ?? null,
      visit_fee: quote.visit_fee,
      subtotal_amount: quote.subtotal_amount,
      total_amount: quote.total_amount,
      special_requests: parsed.data.special_requests ?? null
    })
    .select("*")
    .single();

  if (orderError) {
    return fail("internal_error", orderError.message, 500);
  }

  await supabase.from("events").insert({
    event_type: EVENT_TYPES.QUOTE_SUBMITTED,
    session_id: parsed.data.session_id ?? null,
    order_id: order.id,
    customer_id: customer.id,
    source,
    campaign,
    landing_path: parsed.data.landing_path ?? null,
    device_type: deviceType,
    service_code: order.service_type_code,
    region_code: parsed.data.region_code ?? parsed.data.home?.address_dong ?? null,
    properties: {
      order_number: order.order_number,
      total_amount: order.total_amount
    }
  });

  if (parsed.data.session_id) {
    const sessionRow = {
      session_id: parsed.data.session_id,
      first_event_time: new Date().toISOString(),
      source,
      campaign,
      landing_path: parsed.data.landing_path ?? null,
      device_type: deviceType,
      region_hint: parsed.data.region_code ?? parsed.data.home?.address_dong ?? null,
      order_id: order.id,
      updated_at: new Date().toISOString()
    };
    const { data: existingSession } = await supabase.from("sessions").select("session_id").eq("session_id", parsed.data.session_id).maybeSingle();
    if (existingSession) {
      const { first_event_time: _firstEventTime, session_id: _sessionId, ...sessionPatch } = sessionRow;
      await supabase
        .from("sessions")
        .update(sessionPatch)
        .eq("session_id", parsed.data.session_id);
    } else {
      await supabase.from("sessions").insert(sessionRow);
    }
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      order_id: order.id,
      status: "received",
      expected_minutes: parsed.data.items.reduce((sum, item) => sum + Number(item.metadata?.estimated_minutes ?? 0), 0)
    })
    .select("*")
    .single();

  if (jobError) {
    return fail("internal_error", jobError.message, 500);
  }

  await supabase.from("job_status_logs").insert({
    job_id: job.id,
    from_status: null,
    to_status: "received",
    memo: "주문 생성과 함께 작업 접수"
  });

  await supabase.from("notifications").insert({
    order_id: order.id,
    channel: "mock",
    template_code: "order_submitted",
    recipient: parsed.data.customer.phone,
    send_status: "queued",
    payload: { order_number: order.order_number }
  });

  void notifyNewOrder({
    orderId: order.id,
    orderNumber: order.order_number,
    customerName: customer.name ?? parsed.data.customer.name ?? "고객",
    serviceType: parsed.data.service_type_code ?? parsed.data.items[0]?.service_type_code ?? "unknown",
    addressFull
  });

  return ok(
    {
      customer,
      home,
      order,
      job,
      quote,
      statusUrl: `/orders/${order.id}?accessToken=${order.access_token}`
    },
    { status: 201 }
  );
}

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone")?.replace(/\D/g, "");
  if (!phone || phone.length < 8) return fail("BAD_REQUEST", "phone is required.", 400);

  const supabase = getSupabaseAdmin();
  const { data: customer, error: customerError } = await supabase.from("customers").select("id").eq("phone", phone).maybeSingle();
  if (customerError) return fail("internal_error", customerError.message, 500);
  if (!customer) return ok({ orders: [] });

  const { data, error } = await supabase
    .from("orders")
    .select("id,order_number,status,created_at,service_type_code,skus,jobs(id,assigned_technician_name,status,completed_at)")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) return fail("internal_error", error.message, 500);
  return ok({ orders: data ?? [] });
}
