import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { createOrderDateKey, createOrderNumber } from "@/lib/orders";
import { calculateServerQuote } from "@/lib/server-quote";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };
type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

const convertSchema = z.object({
  service_type_code: z.string().min(1).optional(),
  reason: z.string().optional()
});

async function createSequentialOrderNumber(supabase: SupabaseAdmin) {
  const dateKey = createOrderDateKey();
  const prefix = `BO-${dateKey}-`;
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .like("order_number", `${prefix}%`);

  if (error) throw new Error(error.message);
  return createOrderNumber(new Date(), (count ?? 0) + 1);
}

async function upsertCustomer(supabase: SupabaseAdmin, phone: string, name?: string | null) {
  const { data: existing, error: lookupError } = await supabase
    .from("customers")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);
  if (existing) {
    if (!name?.trim()) return existing;
    const { data, error } = await supabase
      .from("customers")
      .update({ name: name.trim(), acquisition_source: "photo_diagnosis" })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      phone,
      name: name?.trim() || null,
      acquisition_source: "photo_diagnosis"
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function createQuoteForOrder(supabase: SupabaseAdmin, orderId: string, serviceCode: string, diagnosisId: string) {
  const pricing = await calculateServerQuote(supabase, [
    {
      service_type_code: serviceCode,
      item_name: serviceCode,
      qty: 1,
      unit_price: 0,
      options: [],
      metadata: {
        source: "diagnosis",
        diagnosis_id: diagnosisId
      }
    }
  ]);

  const { data: latestQuote, error: latestQuoteError } = await supabase
    .from("quotes")
    .select("version")
    .eq("order_id", orderId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestQuoteError) throw new Error(latestQuoteError.message);

  const version = (latestQuote?.version ?? 0) + 1;
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      order_id: orderId,
      version,
      items: pricing.items,
      total_material: pricing.total_material,
      total_labor: pricing.total_labor,
      visit_fee: pricing.visit_fee,
      discount: pricing.discount,
      total_final: pricing.total_final
    })
    .select("*")
    .single();
  if (quoteError) throw new Error(quoteError.message);

  await supabase
    .from("orders")
    .update({
      status: "quoted",
      service_type_code: serviceCode,
      visit_fee: pricing.visit_fee,
      subtotal_amount: pricing.total_material + pricing.total_labor,
      total_amount: pricing.total_final
    })
    .eq("id", orderId);

  return { quote, pricing };
}

export async function POST(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { id } = await context.params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return validationError(parsedId.error, "Invalid diagnosis id.");

  const body = await readJson(request);
  const parsed = convertSchema.safeParse(body ?? {});
  if (!parsed.success) return validationError(parsed.error, "Invalid conversion request.");

  const supabase = getSupabaseAdmin();
  const { data: diagnosis, error: diagnosisError } = await supabase
    .from("diagnoses")
    .select("*")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (diagnosisError) return fail("internal_error", diagnosisError.message, 500);
  if (!diagnosis) return fail("not_found", "Diagnosis not found.", 404);

  const serviceCode = parsed.data.service_type_code
    ?? diagnosis.suggested_service_code
    ?? diagnosis.service_type_code
    ?? diagnosis.service_code
    ?? "toilet_replace";

  let order = null;
  const rawCustomer = typeof diagnosis.raw_response === "object" && diagnosis.raw_response !== null
    ? (diagnosis.raw_response as { customer?: { name?: string | null; phone?: string | null } }).customer
    : null;
  let customerPhone: string | null = diagnosis.customer_phone ?? rawCustomer?.phone ?? null;
  const customerName = diagnosis.customer_name ?? rawCustomer?.name ?? null;
  let customerId: string | null = null;

  try {
    if (diagnosis.order_id) {
      const { data: existingOrder, error: orderError } = await supabase
        .from("orders")
        .select("*, customers(id,phone,name)")
        .eq("id", diagnosis.order_id)
        .single();
      if (orderError) throw new Error(orderError.message);
      order = existingOrder;
      customerId = existingOrder.customer_id ?? existingOrder.customers?.id ?? null;
      customerPhone = customerPhone ?? existingOrder.customers?.phone ?? null;
    } else {
      if (!customerPhone) {
        return fail("bad_request", "사진확인 접수에 고객 연락처가 없어 주문 전환을 할 수 없습니다.", 400);
      }

      const customer = await upsertCustomer(supabase, customerPhone, customerName);
      customerId = customer.id;

      const addressFull = "사진확인 상담 - 주소 미확인";
      const { data: home, error: homeError } = await supabase
        .from("homes")
        .insert({
          customer_id: customer.id,
          address_full: addressFull,
          address_dong: "주소 미확인",
          size_pyung: 0,
          building_type: "unknown"
        })
        .select("*")
        .single();
      if (homeError) throw new Error(homeError.message);

      const orderNumber = await createSequentialOrderNumber(supabase);
      const skuSnapshot = [{
        sku: serviceCode,
        qty: 1,
        service_type: "labor_service",
        options: [],
        material_skus: [],
        source: "diagnosis",
        diagnosis_id: diagnosis.id
      }];

      const { data: insertedOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          customer_id: customer.id,
          home_id: home.id,
          status: "inquiry",
          service_type_code: serviceCode,
          skus: skuSnapshot,
          channel: "admin",
          source: "photo_diagnosis",
          reason: "photo_diagnosis",
          urgency: "flexible",
          self_diagnosis: parsed.data.reason ?? diagnosis.reason ?? diagnosis.recommendation ?? null,
          inquiry_photos: diagnosis.image_urls ?? diagnosis.photos ?? [],
          special_requests: diagnosis.details ?? null
        })
        .select("*")
        .single();
      if (orderError) throw new Error(orderError.message);
      order = insertedOrder;

      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          order_id: order.id,
          status: "received",
          expected_minutes: 0
        })
        .select("id")
        .single();
      if (jobError) throw new Error(jobError.message);

      await supabase.from("job_status_logs").insert({
        job_id: job.id,
        from_status: null,
        to_status: "received",
        memo: "사진확인에서 주문 전환"
      });
    }

    const { quote, pricing } = await createQuoteForOrder(supabase, order.id, serviceCode, diagnosis.id);

    await supabase
      .from("diagnoses")
      .update({
        order_id: order.id,
        suggested_service_code: serviceCode,
        reviewed_by: "admin",
        reviewed_at: new Date().toISOString()
      })
      .eq("id", diagnosis.id);

    await supabase.from("events").insert({
      event_type: "diagnosis_converted_to_quote",
      order_id: order.id,
      customer_id: customerId,
      service_code: serviceCode,
      properties: {
        diagnosis_id: diagnosis.id,
        quote_id: quote.id,
        order_number: order.order_number,
        total_final: pricing.total_final
      }
    });

    if (customerPhone) {
      const statusUrl = order.access_token
        ? `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://buildus-care-flow.vercel.app"}/orders/${order.id}?accessToken=${order.access_token}`
        : null;
      await supabase.from("notifications").insert({
        order_id: order.id,
        channel: "mock",
        template_code: "diagnosis_quote_ready",
        recipient: customerPhone,
        send_status: "queued",
        payload: {
          order_id: order.id,
          order_number: order.order_number,
          quote_id: quote.id,
          total_final: pricing.total_final,
          status_url: statusUrl
        }
      });
    }

    return ok({ order, quote, pricing, adminUrl: `/admin/orders/${order.id}` });
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Failed to convert diagnosis.", 500);
  }
}
