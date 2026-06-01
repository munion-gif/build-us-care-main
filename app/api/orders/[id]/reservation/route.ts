import { fail, ok } from "@/lib/api-response";
import { readJson, validationError } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { reservationSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

function maxSlotsPerPeriod() {
  const parsed = Number(process.env.MAX_SLOTS_PER_PERIOD ?? 3);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(Math.max(Math.trunc(parsed), 1), 20);
}

function reservationError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("ORDER_NOT_FOUND")) return fail("not_found", "Order not found.", 404);
  if (message.includes("SLOT_RESERVED_DATE")) return fail("SLOT_RESERVED_DATE", "선택한 날짜/시간대는 이미 예약되었습니다. 다른 시간대를 선택해주세요.", 409);
  if (message.includes("SLOT_CLOSED")) return fail("SLOT_CLOSED", "선택한 날짜는 예약이 마감되었습니다.", 409);
  if (message.includes("SLOT_FULL")) return fail("SLOT_FULL", "선택한 시간대는 마감되었습니다. 다른 시간대를 선택해주세요.", 409);
  return fail("conflict", message || "Reservation could not be created.", 409);
}

function kstDateOnly(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function minReservationDateText() {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 3);
  return kstDateOnly(minDate);
}

export async function POST(request: Request, context: Context) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to create reservations.", 500);
  }

  const { id } = await context.params;
  const orderId = uuidSchema.safeParse(id);

  if (!orderId.success) {
    return validationError(orderId.error, "Invalid order id.");
  }

  const body = await readJson(request);
  const normalizedBody =
    body && typeof body === "object"
      ? {
          ...body,
          reserved_date: (body as Record<string, unknown>).reserved_date ?? (body as Record<string, unknown>).reservationDate,
          time_slot: (body as Record<string, unknown>).time_slot ?? (body as Record<string, unknown>).timeSlot
        }
      : body;
  const parsed = reservationSchema.safeParse(normalizedBody);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid reservation request.");
  }

  if (parsed.data.reserved_date < minReservationDateText()) {
    return fail("INVALID_DATE", "제품과 일정 준비 기간 때문에 예약은 오늘 기준 3일 이후 날짜부터 가능합니다.", 400);
  }

  const supabase = getSupabaseAdmin();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,status,is_test")
    .eq("id", orderId.data)
    .single();

  if (orderError || !order) {
    return fail("not_found", "Order not found.", 404);
  }

  const { data: existingReservation, error: existingReservationError } = await supabase
    .from("reservations")
    .select("*")
    .eq("order_id", orderId.data)
    .in("status", ["pending", "confirmed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingReservationError) {
    return fail("internal_error", existingReservationError.message, 500);
  }

  if (existingReservation) {
    return ok({ reservation: existingReservation, order_status: order.status, idempotent: true });
  }

  const protectedStatuses = ["paid", "product_paid", "scheduled", "in_progress", "completed", "done", "canceled", "issue", "warranty"];
  const nextOrderStatus = protectedStatuses.includes(order.status)
    ? order.status
    : parsed.data.status === "confirmed"
      ? "scheduled"
      : order.status;

  if (order.is_test === true) {
    const { data: reservation, error: reservationInsertError } = await supabase
      .from("reservations")
      .insert({
        order_id: orderId.data,
        reserved_date: parsed.data.reserved_date,
        time_slot: parsed.data.time_slot,
        status: parsed.data.status,
        notes: parsed.data.notes ?? null
      })
      .select("*")
      .single();

    if (reservationInsertError) {
      return fail("internal_error", reservationInsertError.message, 500);
    }

    if (nextOrderStatus !== order.status) {
      const { error: orderUpdateError } = await supabase.from("orders").update({ status: nextOrderStatus }).eq("id", orderId.data);
      if (orderUpdateError) {
        return fail("internal_error", orderUpdateError.message, 500);
      }
    }

    return ok({ reservation, order_status: nextOrderStatus }, { status: 201 });
  }

  const { data: reservation, error } = await supabase
    .rpc("reserve_order_slot", {
      p_order_id: orderId.data,
      p_reserved_date: parsed.data.reserved_date,
      p_time_slot: parsed.data.time_slot,
      p_status: parsed.data.status,
      p_notes: parsed.data.notes ?? null,
      p_default_cap: maxSlotsPerPeriod()
    })
    .single();

  if (error) {
    return reservationError(error);
  }

  return ok({ reservation, order_status: nextOrderStatus }, { status: 201 });
}
