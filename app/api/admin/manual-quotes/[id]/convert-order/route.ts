import { ok, fail } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { createOrderDateKey, createOrderNumber } from "@/lib/orders";
import { createPaymentOrderId } from "@/lib/payment-amounts";
import { closedReservationReason, isClosedReservationDate, minReservationDateText } from "@/lib/reservation-policy";
import { periodCapFromConfig, resolveDefaultSlotCap, type SlotPeriod } from "@/lib/slot-capacity";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

const BUILDUSCARE_SOURCE = "builduscare_admin_manual_quote";

async function createSequentialOrderNumber(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const dateKey = createOrderDateKey();
  const prefix = `BO-${dateKey}-`;
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .like("order_number", `${prefix}%`);

  if (error) throw new Error(error.message);
  return createOrderNumber(new Date(), (count ?? 0) + 1);
}

function serviceCodeFromQuote(quote: any) {
  const items = Array.isArray(quote?.items) ? quote.items : [];
  return String(items[0]?.metadata?.service_type_code ?? items[0]?.sku ?? "toilet_replace");
}

function skuSnapshotFromQuote(quote: any) {
  const items = Array.isArray(quote?.items) ? quote.items : [];
  return items.map((item: any) => ({
    sku: item?.metadata?.service_type_code ?? item?.sku,
    qty: Number(item?.qty ?? 1),
    service_type: "replacement_product",
    options: item?.options ?? [],
    material_skus: item?.material_skus ?? [],
    metadata: item?.metadata ?? {}
  }));
}

function orderNameFromQuote(quote: any) {
  const items = Array.isArray(quote?.items) ? quote.items : [];
  const first = items[0];
  const product = first?.metadata?.selected_replacement_product ?? {};
  const label = [product?.brand, product?.model].filter(Boolean).join(" ").trim() || first?.item_name || "제품 주문";
  return items.length > 1 ? `${label} 외 ${items.length - 1}건` : label;
}

function scheduledAtForSlot(dateText: string, slot: SlotPeriod) {
  return `${dateText}T${slot === "afternoon" ? "13:00:00" : "09:00:00"}+09:00`;
}

function slotFromScheduledAt(value?: string | null): SlotPeriod | null {
  if (!value) return null;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(new Date(value)));
  return hour < 13 ? "morning" : "afternoon";
}

function kstDayUtcRange(dateText: string) {
  const start = new Date(`${dateText}T00:00:00+09:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function resolveRequestedSlotCap(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  reservedDate: string;
  timeSlot: SlotPeriod;
}) {
  const { supabase, reservedDate, timeSlot } = params;
  const [configResult, capResult] = await Promise.all([
    supabase
      .from("slot_configs")
      .select("date,morning_cap,afternoon_cap,blocked,type,cap_value")
      .eq("type", "date")
      .eq("date", reservedDate)
      .maybeSingle(),
    resolveDefaultSlotCap(supabase)
  ]);

  if (configResult.error) throw new Error(configResult.error.message);
  return {
    blocked: Boolean(configResult.data?.blocked),
    cap: periodCapFromConfig(configResult.data, timeSlot, capResult.cap),
    capSource: capResult.capSource,
    activeTechnicianCount: capResult.activeTechnicianCount
  };
}

async function assertSlotAvailable(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  reservedDate: string;
  timeSlot: SlotPeriod;
  cap: number;
}) {
  const { supabase, reservedDate, timeSlot, cap } = params;
  const range = kstDayUtcRange(reservedDate);
  const { data, error } = await supabase
    .from("jobs")
    .select("id,order_id,scheduled_at,status")
    .not("scheduled_at", "is", null)
    .neq("status", "cancelled")
    .gte("scheduled_at", range.start)
    .lt("scheduled_at", range.end);

  if (error) return fail("internal_error", error.message, 500);
  const usedCount = (data ?? []).filter((job) => slotFromScheduledAt(job.scheduled_at) === timeSlot).length;
  if (usedCount >= cap) {
    return fail("SLOT_FULL", "선택한 시간대는 마감되었습니다. 다른 시간대를 선택해주세요.", 409);
  }
  return null;
}

async function validateManualQuoteSchedule(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  reservedDate: string;
  timeSlot: SlotPeriod;
}) {
  const { supabase, reservedDate, timeSlot } = params;

  if (reservedDate < minReservationDateText()) {
    return fail("INVALID_DATE", "제품과 일정 준비 기간 때문에 방문 일정은 영업일 기준 4일 이후 날짜부터 가능합니다.", 400);
  }
  if (isClosedReservationDate(reservedDate)) {
    return fail("SLOT_CLOSED", closedReservationReason(reservedDate), 409);
  }

  const slotCap = await resolveRequestedSlotCap({ supabase, reservedDate, timeSlot });
  if (slotCap.blocked) {
    return fail("SLOT_CLOSED", "선택한 날짜는 예약이 마감되었습니다.", 409);
  }
  if (slotCap.cap <= 0) {
    return fail(
      "SLOT_UNAVAILABLE",
      slotCap.capSource === "no_active_technicians"
        ? "현재 예약 가능한 기사 일정이 없습니다. 카톡 상담으로 가능 일정을 확인해주세요."
        : "선택한 시간대는 마감되었습니다. 다른 시간대를 선택해주세요.",
      409,
      { activeTechnicianCount: slotCap.activeTechnicianCount }
    );
  }

  return assertSlotAvailable({ supabase, reservedDate, timeSlot, cap: slotCap.cap });
}

export async function POST(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  if (!hasSupabaseEnv()) {
    return fail("local_mode", "Supabase 환경이 없어 수동 견적을 제품 주문으로 전환할 수 없습니다.", 409, { localMode: true });
  }

  const { id } = await context.params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return fail("invalid_id", "Invalid manual quote id.", 400);

  try {
    const supabase = getSupabaseAdmin();
    const { data: manualQuote, error: quoteError } = await supabase
      .from("manual_quotes")
      .select("*")
      .eq("id", parsedId.data)
      .maybeSingle();

    if (quoteError) throw new Error(quoteError.message);
    if (!manualQuote) return fail("not_found", "수동 견적을 찾을 수 없습니다.", 404);
    if (manualQuote.converted_order_id) {
      return ok({ orderId: manualQuote.converted_order_id, alreadyConverted: true });
    }

    const now = new Date().toISOString();
    const addressText = String(manualQuote.address_text ?? "").trim() || "주소 확인 중";
    const serviceTypeCode = serviceCodeFromQuote(manualQuote);
    const totalMaterial = Number(manualQuote.total_material ?? 0);
    const totalLabor = Math.max(
      0,
      Number(manualQuote.total_labor ?? 0) + Number(manualQuote.visit_fee ?? 0) - Number(manualQuote.discount ?? 0)
    );
    const totalFinal = Number(manualQuote.total_final ?? 0);
    const reservedDate = typeof manualQuote.reserved_date === "string" ? manualQuote.reserved_date.slice(0, 10) : null;
    const timeSlot = manualQuote.time_slot === "morning" || manualQuote.time_slot === "afternoon" ? manualQuote.time_slot as SlotPeriod : null;

    if (reservedDate && timeSlot) {
      const scheduleError = await validateManualQuoteSchedule({ supabase, reservedDate, timeSlot });
      if (scheduleError) return scheduleError;
    }

    const [customerResult, orderNumber] = await Promise.all([
      supabase
        .from("customers")
        .upsert({
          phone: manualQuote.customer_phone,
          name: manualQuote.customer_name,
          acquisition_source: BUILDUSCARE_SOURCE,
          address_full: addressText,
          address_dong: "unknown",
          address_apt: null,
          housing_type: "unknown"
        }, { onConflict: "phone" })
        .select("*")
        .single(),
      createSequentialOrderNumber(supabase)
    ]);
    if (customerResult.error) throw new Error(customerResult.error.message);
    const customer = customerResult.data;

    const { data: home, error: homeError } = await supabase
      .from("homes")
      .insert({
        customer_id: customer.id,
        address_full: addressText,
        address_dong: "unknown",
        address_apt: null,
        postal_code: null,
        size_pyung: 0,
        building_type: "unknown"
      })
      .select("*")
      .single();
    if (homeError) throw new Error(homeError.message);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: customer.id,
        home_id: home.id,
        status: totalMaterial > 0 ? "pending_product_payment" : "quoted",
        skus: skuSnapshotFromQuote(manualQuote),
        channel: "admin",
        source: BUILDUSCARE_SOURCE,
        reason: "manual_quote_conversion",
        urgency: "scheduled",
        self_diagnosis: "관리자 수동 견적에서 제품 주문으로 전환",
        service_type_code: serviceTypeCode,
        visit_fee: Number(manualQuote.visit_fee ?? 0),
        subtotal_amount: totalMaterial + totalLabor,
        total_amount: totalFinal,
        online_payment_amount: totalMaterial,
        onsite_payment_amount: totalLabor,
        onsite_payment_status: totalLabor > 0 ? "PENDING" : "DONE",
        special_requests: `수동 견적 ${manualQuote.quote_number}에서 전환`,
        inquiry_photos: [],
        is_test: false
      })
      .select("*")
      .single();
    if (orderError) throw new Error(orderError.message);

    const { data: insertedQuote, error: insertedQuoteError } = await supabase
      .from("quotes")
      .insert({
        order_id: order.id,
        version: 1,
        items: manualQuote.items,
        total_material: Number(manualQuote.total_material ?? 0),
        total_labor: Number(manualQuote.total_labor ?? 0),
        visit_fee: Number(manualQuote.visit_fee ?? 0),
        discount: Number(manualQuote.discount ?? 0),
        total_final: totalFinal,
        accepted_at: now
      })
      .select("*")
      .single();
    if (insertedQuoteError) throw new Error(insertedQuoteError.message);

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        quote_id: insertedQuote.id,
        provider: "bank_transfer",
        provider_order_id: createPaymentOrderId(),
        method: "transfer",
        order_name: orderNameFromQuote(manualQuote),
        amount: totalMaterial,
        status: totalMaterial > 0 ? "pending" : "done",
        provider_status: totalMaterial > 0 ? "WAITING_DEPOSIT" : "DONE",
        requested_at: now,
        product_amount: totalMaterial,
        service_fee_amount: totalLabor,
        total_amount: totalFinal,
        online_payment_amount: totalMaterial,
        onsite_payment_amount: totalLabor,
        onsite_payment_status: totalLabor > 0 ? "PENDING" : "DONE",
        quote_status: totalMaterial > 0 ? "pending_product_payment" : "quoted"
      })
      .select("*")
      .single();
    if (paymentError) throw new Error(paymentError.message);

    let job = null;
    if (reservedDate && timeSlot) {
      const { data: insertedJob, error: jobError } = await supabase
        .from("jobs")
        .insert({
          order_id: order.id,
          scheduled_at: scheduledAtForSlot(reservedDate, timeSlot),
          scheduled_date: reservedDate,
          status: "assigned",
          expected_minutes: 0
        })
        .select("*")
        .single();
      if (jobError) throw new Error(jobError.message);
      job = insertedJob;
    }

    const { error: updateManualQuoteError } = await supabase
      .from("manual_quotes")
      .update({
        converted_order_id: order.id,
        converted_at: now
      })
      .eq("id", manualQuote.id);
    if (updateManualQuoteError) throw new Error(updateManualQuoteError.message);

    return ok({ order, quote: insertedQuote, payment, job, alreadyConverted: false });
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Failed to convert manual quote.", 500);
  }
}
