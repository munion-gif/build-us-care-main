import { z } from "zod";
import { ok, fail } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { buildManualQuoteDocumentInput } from "@/lib/manual-quote-document";
import { closedReservationReason, isClosedReservationDate, minReservationDateText } from "@/lib/reservation-policy";
import { calculateServerQuote } from "@/lib/server-quote";
import { periodCapFromConfig, resolveDefaultSlotCap, type SlotPeriod } from "@/lib/slot-capacity";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { findReplacementProduct, isProductSelectionService } from "@/lib/replacement-products";
import { uuidSchema } from "@/lib/validation";

const manualQuoteItemSchema = z.object({
  service_type_code: z.string().min(1),
  product_id: z.string().min(1),
  qty: z.coerce.number().int().positive().default(1)
});

const manualQuoteSchema = z.object({
  manual_quote_id: z.string().uuid().optional().nullable(),
  service_type_code: z.string().min(1),
  customer_name: z.string().trim().min(1),
  customer_phone: z.string().trim().min(1),
  address_text: z.string().trim().min(1),
  visit_fee: z.coerce.number().int().min(0).default(0),
  discount: z.coerce.number().int().min(0).default(0),
  schedule: z.object({
    reserved_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time_slot: z.enum(["morning", "afternoon"])
  }).nullable().optional(),
  items: z.array(manualQuoteItemSchema).min(1)
});

function manualQuoteItemToInput(item: z.infer<typeof manualQuoteItemSchema>) {
  if (!isProductSelectionService(item.service_type_code)) {
    throw new Error("제품 카탈로그 기반 서비스만 견적서를 작성할 수 있습니다.");
  }

  const product = findReplacementProduct(item.service_type_code, item.product_id);
  if (!product) {
    throw new Error("선택한 제품 정보를 찾을 수 없습니다.");
  }

  return {
    service_type_code: item.service_type_code,
    item_name: `${product.brand} ${product.model}`.trim() || product.categoryName,
    qty: item.qty,
    unit_price: Number(product.price ?? 0),
    options: [],
    metadata: {
      selected_replacement_product_id: product.id,
      ...(product.serviceCode === "toilet_replace" ? { selected_toilet_product_id: product.id } : {})
    }
  };
}

function newQuoteNumber() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `MQ-${yyyy}${mm}${dd}-${Date.now().toString(36).toUpperCase()}`;
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
  orderId?: string | null;
  reservedDate: string;
  timeSlot: SlotPeriod;
  cap: number;
}) {
  const { supabase, orderId, reservedDate, timeSlot, cap } = params;
  const range = kstDayUtcRange(reservedDate);
  const { data, error } = await supabase
    .from("jobs")
    .select("id,order_id,scheduled_at,status")
    .not("scheduled_at", "is", null)
    .neq("status", "cancelled")
    .gte("scheduled_at", range.start)
    .lt("scheduled_at", range.end);

  if (error) return fail("internal_error", error.message, 500);
  const usedCount = (data ?? []).filter((job) => job.order_id !== orderId && slotFromScheduledAt(job.scheduled_at) === timeSlot).length;
  if (usedCount >= cap) {
    return fail("SLOT_FULL", "선택한 시간대는 마감되었습니다. 다른 시간대를 선택해주세요.", 409);
  }
  return null;
}

async function validateSchedule(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  schedule: NonNullable<z.infer<typeof manualQuoteSchema>["schedule"]>;
  orderId?: string | null;
}) {
  const { supabase, schedule, orderId } = params;
  const reservedDate = schedule.reserved_date;
  const timeSlot = schedule.time_slot;

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

  return assertSlotAvailable({ supabase, orderId, reservedDate, timeSlot, cap: slotCap.cap });
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const body = await readJson(request);
  const parsed = manualQuoteSchema.safeParse(body ?? {});
  if (!parsed.success) return validationError(parsed.error, "Invalid manual quote payload.");

  if (!hasSupabaseEnv()) {
    return fail("local_mode", "Supabase 환경이 없어 수동 견적은 브라우저 임시 저장으로 처리해야 합니다.", 409, { localMode: true });
  }

  const manualQuoteId = parsed.data.manual_quote_id ? uuidSchema.parse(parsed.data.manual_quote_id) : null;

  try {
    const supabase = getSupabaseAdmin();
    const items = parsed.data.items.map(manualQuoteItemToInput);
    const pricing = await calculateServerQuote(supabase, items, {
      visitFee: parsed.data.visit_fee,
      discount: parsed.data.discount
    });

    if (parsed.data.schedule) {
      const scheduleError = await validateSchedule({
        supabase,
        schedule: parsed.data.schedule,
        orderId: null
      });
      if (scheduleError) return scheduleError;
    }

    const row = {
      customer_name: parsed.data.customer_name,
      customer_phone: parsed.data.customer_phone,
      address_text: parsed.data.address_text,
      items: pricing.items,
      total_material: pricing.total_material,
      total_labor: pricing.total_labor,
      visit_fee: pricing.visit_fee,
      discount: pricing.discount,
      total_final: pricing.total_final,
      reserved_date: parsed.data.schedule?.reserved_date ?? null,
      time_slot: parsed.data.schedule?.time_slot ?? null
    };

    const query = manualQuoteId
      ? supabase
          .from("manual_quotes")
          .update(row)
          .eq("id", manualQuoteId)
          .select("*")
          .single()
      : supabase
          .from("manual_quotes")
          .insert({ ...row, quote_number: newQuoteNumber() })
          .select("*")
          .single();

    const { data: quote, error } = await query;
    if (error) throw new Error(error.message);

    return ok({
      manualQuote: quote,
      pricing,
      quoteDocumentInput: buildManualQuoteDocumentInput(quote)
    });
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Failed to save manual quote.", 500);
  }
}
