import { fail, ok } from "@/lib/api-response";
import { hasAdminAccess } from "@/lib/admin-auth";
import { matchLocalBuildusOrderFromRequest } from "@/lib/builduscare-local-order-server";
import { readJson, validationError } from "@/lib/errors";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { periodCapFromConfig, resolveDefaultSlotCap, type SlotPeriod } from "@/lib/slot-capacity";
import { closedReservationReason, isClosedReservationDate, minReservationDateText } from "@/lib/reservation-policy";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { reservationSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

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

function asArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function activeVisitJob(jobs: any[]) {
  return jobs
    .filter((job) => job.status !== "cancelled")
    .sort((a, b) => String(b.scheduled_at ?? b.created_at ?? "").localeCompare(String(a.scheduled_at ?? a.created_at ?? "")))[0] ?? null;
}

function jobReservationPayload(job: any, reservedDate: string, timeSlot: SlotPeriod) {
  return {
    id: job.id,
    reserved_date: reservedDate,
    time_slot: timeSlot,
    status: job.status ?? "scheduled",
    source: "jobs"
  };
}

async function assertSlotAvailable(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  orderId: string;
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

export async function POST(request: Request, context: Context) {
  if (!hasSupabaseEnv()) {
    const { id } = await context.params;
    const body = await readJson(request);
    const accessToken = typeof body?.accessToken === "string" ? body.accessToken : null;
    const localOrder = matchLocalBuildusOrderFromRequest(request, { orderId: id, accessToken });
    if (localOrder) {
      return fail("LOCAL_READ_ONLY", "로컬 확인 모드에서는 방문 일정을 저장하지 않습니다.", 409, { localMode: true });
    }
    return fail("not_found", "로컬 확인 모드에서 일치하는 주문을 찾을 수 없어요.", 404, { localMode: true });
  }

  const { id } = await context.params;
  const orderId = uuidSchema.safeParse(id);

  if (!orderId.success) {
    return validationError(orderId.error, "Invalid order id.");
  }

  const rateLimit = checkRateLimit(`reservation:${getClientIp(request.headers)}:${orderId.data}`, {
    limit: 20,
    windowMs: 10 * 60_000
  });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds, "방문 일정 요청이 많습니다. 잠시 후 다시 시도해주세요.");
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
    return fail("INVALID_DATE", "제품과 일정 준비 기간 때문에 방문 일정은 영업일 기준 4일 이후 날짜부터 가능합니다.", 400);
  }
  if (isClosedReservationDate(parsed.data.reserved_date)) {
    return fail("SLOT_CLOSED", closedReservationReason(parsed.data.reserved_date), 409);
  }

  if (parsed.data.time_slot !== "morning" && parsed.data.time_slot !== "afternoon") {
    return fail("INVALID_TIME_SLOT", "현재 방문 일정은 오전 또는 오후 시간대만 선택할 수 있습니다.", 400);
  }

  const supabase = getSupabaseAdmin();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,status,is_test,access_token,jobs(*)")
    .eq("id", orderId.data)
    .single();

  if (orderError || !order) {
    return fail("not_found", "Order not found.", 404);
  }

  const isGuest = parsed.data.accessToken && parsed.data.accessToken === order.access_token;
  if (!isGuest && !hasAdminAccess(request)) {
    return fail("forbidden", "A valid accessToken is required.", 403);
  }

  const existingJob = activeVisitJob(asArray(order.jobs));
  const existingDate = existingJob?.scheduled_at ? kstDateOnly(existingJob.scheduled_at) : null;
  const existingSlot = existingJob?.scheduled_at ? slotFromScheduledAt(existingJob.scheduled_at) : null;
  if (existingJob && existingDate === parsed.data.reserved_date && existingSlot === parsed.data.time_slot) {
    if (parsed.data.status === "confirmed" && (existingJob.status !== "scheduled" || order.status !== "scheduled")) {
      const { data: confirmedJob, error: confirmJobError } = await supabase
        .from("jobs")
        .update({ status: "scheduled" })
        .eq("id", existingJob.id)
        .select("*")
        .single();
      if (confirmJobError) return fail("internal_error", confirmJobError.message, 500);

      const { error: confirmOrderError } = await supabase
        .from("orders")
        .update({ status: "scheduled" })
        .eq("id", orderId.data);
      if (confirmOrderError) return fail("internal_error", confirmOrderError.message, 500);

      return ok({
        reservation: jobReservationPayload(confirmedJob, parsed.data.reserved_date, parsed.data.time_slot),
        order_status: "scheduled",
        confirmed: true
      });
    }
    return ok({ reservation: jobReservationPayload(existingJob, parsed.data.reserved_date, parsed.data.time_slot), order_status: order.status, idempotent: true });
  }

  const protectedStatuses = ["in_progress", "completed", "done", "canceled", "issue", "warranty"];
  const nextOrderStatus = protectedStatuses.includes(order.status)
    ? order.status
    : parsed.data.status === "confirmed"
      ? "scheduled"
      : order.status;

  try {
    const slotCap = await resolveRequestedSlotCap({
      supabase,
      reservedDate: parsed.data.reserved_date,
      timeSlot: parsed.data.time_slot
    });

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
    if (order.is_test !== true) {
      const slotError = await assertSlotAvailable({
        supabase,
        orderId: orderId.data,
        reservedDate: parsed.data.reserved_date,
        timeSlot: parsed.data.time_slot,
        cap: slotCap.cap
      });
      if (slotError) return slotError;
    }
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Failed to resolve slot capacity.", 500);
  }

  const scheduledAt = scheduledAtForSlot(parsed.data.reserved_date, parsed.data.time_slot);
  const nextJobStatus = parsed.data.status === "confirmed" ? "scheduled" : "assigned";
  const jobMutation = existingJob
    ? supabase
        .from("jobs")
        .update({
          scheduled_at: scheduledAt,
          scheduled_date: parsed.data.reserved_date,
          status: nextJobStatus
        })
        .eq("id", existingJob.id)
        .select("*")
        .single()
    : supabase
        .from("jobs")
        .insert({
          order_id: orderId.data,
          scheduled_at: scheduledAt,
          scheduled_date: parsed.data.reserved_date,
          status: nextJobStatus
        })
        .select("*")
        .single();

  const { data: job, error } = await jobMutation;

  if (error) {
    return fail("internal_error", error.message, 500);
  }

  if (nextOrderStatus !== order.status) {
    const { error: orderUpdateError } = await supabase.from("orders").update({ status: nextOrderStatus }).eq("id", orderId.data);
    if (orderUpdateError) return fail("internal_error", orderUpdateError.message, 500);
  }

  return ok({ reservation: jobReservationPayload(job, parsed.data.reserved_date, parsed.data.time_slot), order_status: nextOrderStatus }, { status: 201 });
}
