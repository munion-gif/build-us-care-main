import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { readJson, validationError } from "@/lib/errors";
import { insertJobStatusLog } from "@/lib/jobs";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { accessTokenSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

type SlotPeriod = "morning" | "afternoon";
type JobAction = "kept" | "updated" | "released";

const DEFAULT_MAX_SLOTS = 3;
const ACTIVE_RESERVATION_STATUSES = ["pending", "confirmed"];
const FINAL_JOB_STATUSES = ["in_progress", "done", "inspected"];
const RESCHEDULABLE_ORDER_STATUSES = ["paid", "product_paid", "scheduled"];

const rescheduleSchema = z.object({
  accessToken: accessTokenSchema,
  reservedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reserved_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeSlot: z.enum(["morning", "afternoon"]).optional(),
  time_slot: z.enum(["morning", "afternoon"]).optional()
});

function boundedNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function maxSlotsPerPeriod() {
  return boundedNumber(process.env.MAX_SLOTS_PER_PERIOD ?? null, DEFAULT_MAX_SLOTS, 1, 20);
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

function kstHour(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    hour12: false
  }).format(date);
  return Number(hour);
}

function slotFromScheduledAt(value: string | Date | null): SlotPeriod | null {
  if (!value) return null;
  return kstHour(value) < 13 ? "morning" : "afternoon";
}

function kstDayUtcRange(dateText: string) {
  const start = new Date(`${dateText}T00:00:00+09:00`);
  const end = new Date(`${dateText}T00:00:00+09:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function minReservationDateText() {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 3);
  return kstDateOnly(minDate);
}

function isBeforeMinReservationDate(dateText: string) {
  return dateText < minReservationDateText();
}

function scheduledAtForSlot(dateText: string, slot: SlotPeriod) {
  return `${dateText}T${slot === "afternoon" ? "13:00:00" : "09:00:00"}+09:00`;
}

function sortLatest(rows: any[]) {
  return [...rows].sort((a, b) => String(b.scheduled_at ?? b.created_at ?? "").localeCompare(String(a.scheduled_at ?? a.created_at ?? "")));
}

function primaryActiveReservation(reservations: any[]) {
  return [...reservations]
    .filter((reservation) => ACTIVE_RESERVATION_STATUSES.includes(String(reservation.status)))
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0] ?? null;
}

function primaryActiveJob(jobs: any[]) {
  return sortLatest(jobs.filter((job) => String(job.status) !== "cancelled"))[0] ?? null;
}

async function effectiveDefaultCap(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const fallback = maxSlotsPerPeriod();
  const [capConfigResult, activeTechniciansResult] = await Promise.all([
    supabase.from("app_configs").select("value").eq("key", "slot_cap").maybeSingle(),
    supabase.from("technicians").select("id", { count: "exact", head: true }).eq("is_active", true)
  ]);

  if (capConfigResult.error) throw new Error(capConfigResult.error.message);
  if (activeTechniciansResult.error) throw new Error(activeTechniciansResult.error.message);

  const manualCap = Number(capConfigResult.data?.value);
  if (Number.isFinite(manualCap) && manualCap > 0) return boundedNumber(String(manualCap), fallback, 1, 20);

  const activeTechnicianCount = activeTechniciansResult.count ?? 0;
  return activeTechnicianCount > 0 ? boundedNumber(String(activeTechnicianCount), fallback, 1, 20) : fallback;
}

async function assertSlotAvailable(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  orderId: string;
  reservedDate: string;
  timeSlot: SlotPeriod;
}) {
  const { supabase, orderId, reservedDate, timeSlot } = params;
  if (isBeforeMinReservationDate(reservedDate)) {
    return fail("INVALID_DATE", "제품과 일정 준비 기간 때문에 예약 변경은 오늘 기준 3일 이후 날짜부터 가능합니다.", 400);
  }

  const { data: config, error: configError } = await supabase
    .from("slot_configs")
    .select("date,morning_cap,afternoon_cap,blocked,type,cap_value")
    .eq("type", "date")
    .eq("date", reservedDate)
    .maybeSingle();

  if (configError) return fail("INTERNAL_ERROR", configError.message, 500);
  if (config?.blocked) return fail("SLOT_CLOSED", "선택한 날짜는 예약이 마감되었습니다.", 409);

  const range = kstDayUtcRange(reservedDate);
  const [jobsResult, reservationsResult] = await Promise.all([
    supabase
      .from("jobs")
      .select("id,order_id,scheduled_at,status")
      .not("scheduled_at", "is", null)
      .neq("status", "cancelled")
      .gte("scheduled_at", range.start)
      .lt("scheduled_at", range.end),
    supabase
      .from("reservations")
      .select("id,order_id,reserved_date,time_slot,status")
      .eq("reserved_date", reservedDate)
      .neq("status", "cancelled")
  ]);

  const firstError = jobsResult.error ?? reservationsResult.error;
  if (firstError) return fail("INTERNAL_ERROR", firstError.message, 500);

  const hasExistingDateBooking =
    (jobsResult.data ?? []).some((job) => job.order_id !== orderId) ||
    (reservationsResult.data ?? []).some((reservation) => reservation.order_id !== orderId);

  if (hasExistingDateBooking) {
    return fail("SLOT_RESERVED_DATE", "이미 예약이 있는 날짜입니다. 다른 날짜를 선택해주세요.", 409);
  }

  return null;
}

async function sameTechnicianAvailable(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  job: any;
  reservedDate: string;
  timeSlot: SlotPeriod;
}) {
  const { supabase, job, reservedDate, timeSlot } = params;
  if (!job?.technician_id) return false;

  const { data: technician, error: technicianError } = await supabase
    .from("technicians")
    .select("id,is_active")
    .eq("id", job.technician_id)
    .maybeSingle();

  if (technicianError || !technician?.is_active) return false;

  const scheduledAt = new Date(scheduledAtForSlot(reservedDate, timeSlot));
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) return false;

  const range = kstDayUtcRange(reservedDate);
  const { data: technicianJobs, error } = await supabase
    .from("jobs")
    .select("id,scheduled_at,status")
    .eq("technician_id", job.technician_id)
    .not("scheduled_at", "is", null)
    .neq("status", "cancelled")
    .gte("scheduled_at", range.start)
    .lt("scheduled_at", range.end);

  if (error) return false;

  return (technicianJobs ?? []).filter((assignedJob) => assignedJob.id !== job.id && slotFromScheduledAt(assignedJob.scheduled_at) === timeSlot).length === 0;
}

export async function PATCH(request: Request, context: Context) {
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required to reschedule orders.", 500);

  const { id } = await context.params;
  const orderId = uuidSchema.safeParse(id);
  if (!orderId.success) return validationError(orderId.error, "Invalid order id.");

  const parsed = rescheduleSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error, "Invalid reschedule request.");

  const reservedDate = parsed.data.reserved_date ?? parsed.data.reservedDate;
  const timeSlot = parsed.data.time_slot ?? parsed.data.timeSlot;
  if (!reservedDate || !timeSlot) {
    return fail("VALIDATION_ERROR", "예약 날짜와 시간대를 선택해주세요.", 400);
  }

  const supabase = getSupabaseAdmin();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,status,access_token,customer_id,reservations(*),jobs(*)")
    .eq("id", orderId.data)
    .maybeSingle();

  if (orderError) return fail("INTERNAL_ERROR", orderError.message, 500);
  if (!order) return fail("NOT_FOUND", "주문을 찾을 수 없습니다.", 404);
  if (order.access_token !== parsed.data.accessToken) return fail("FORBIDDEN", "예약 변경 권한이 확인되지 않았습니다.", 403);
  if (!RESCHEDULABLE_ORDER_STATUSES.includes(String(order.status))) {
    return fail("ORDER_NOT_RESCHEDULABLE", "현재 상태에서는 예약을 변경할 수 없습니다.", 409);
  }

  const reservations = Array.isArray(order.reservations) ? order.reservations : order.reservations ? [order.reservations] : [];
  const jobs = Array.isArray(order.jobs) ? order.jobs : order.jobs ? [order.jobs] : [];
  const activeReservation = primaryActiveReservation(reservations);
  const activeJob = primaryActiveJob(jobs);

  if (activeJob && FINAL_JOB_STATUSES.includes(String(activeJob.status))) {
    return fail("JOB_ALREADY_STARTED", "시공이 시작된 주문은 예약 변경이 어렵습니다.", 409);
  }

  if (activeReservation?.reserved_date === reservedDate && activeReservation?.time_slot === timeSlot) {
    return ok({
      orderId: order.id,
      orderStatus: order.status,
      reservation: { reservedDate, timeSlot },
      jobAction: "kept" satisfies JobAction,
      idempotent: true
    });
  }

  const slotError = await assertSlotAvailable({
    supabase,
    orderId: order.id,
    reservedDate,
    timeSlot
  });
  if (slotError) return slotError;

  if (activeReservation) {
    const { error: cancelReservationError } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", activeReservation.id);
    if (cancelReservationError) return fail("INTERNAL_ERROR", cancelReservationError.message, 500);
  }

  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .insert({
      order_id: order.id,
      reserved_date: reservedDate,
      time_slot: timeSlot,
      status: "confirmed",
      notes: "고객 예약 변경"
    })
    .select("*")
    .single();

  if (reservationError) return fail("INTERNAL_ERROR", reservationError.message, 500);

  const fromDate = activeReservation?.reserved_date ?? (activeJob?.scheduled_at ? kstDateOnly(activeJob.scheduled_at) : null);
  const fromSlot = activeReservation?.time_slot ?? slotFromScheduledAt(activeJob?.scheduled_at ?? null);
  let jobAction: JobAction = "kept";
  let orderStatus = String(order.status);

  if (activeJob) {
    const canKeepTechnician = await sameTechnicianAvailable({
      supabase,
      job: activeJob,
      reservedDate,
      timeSlot
    });

    if (canKeepTechnician) {
      const { error: updateJobError } = await supabase
        .from("jobs")
        .update({
          scheduled_at: scheduledAtForSlot(reservedDate, timeSlot),
          scheduled_date: reservedDate,
          status: "scheduled"
        })
        .eq("id", activeJob.id);
      if (updateJobError) return fail("INTERNAL_ERROR", updateJobError.message, 500);
      await insertJobStatusLog(supabase, activeJob.id, activeJob.status ?? null, "scheduled", "고객 예약 변경");
      const { error: orderUpdateError } = await supabase.from("orders").update({ status: "scheduled" }).eq("id", order.id);
      if (orderUpdateError) return fail("INTERNAL_ERROR", orderUpdateError.message, 500);
      jobAction = "updated";
      orderStatus = "scheduled";
    } else {
      const { error: releaseJobError } = await supabase.from("jobs").update({ status: "cancelled" }).eq("id", activeJob.id);
      if (releaseJobError) return fail("INTERNAL_ERROR", releaseJobError.message, 500);
      await insertJobStatusLog(supabase, activeJob.id, activeJob.status ?? null, "cancelled", "고객 예약 변경으로 기사 재배정 필요");
      const { error: orderUpdateError } = await supabase.from("orders").update({ status: "paid" }).eq("id", order.id);
      if (orderUpdateError) return fail("INTERNAL_ERROR", orderUpdateError.message, 500);
      jobAction = "released";
      orderStatus = "paid";
    }
  } else if (order.status === "scheduled") {
    const { error: orderUpdateError } = await supabase.from("orders").update({ status: "paid" }).eq("id", order.id);
    if (orderUpdateError) return fail("INTERNAL_ERROR", orderUpdateError.message, 500);
    orderStatus = "paid";
  }

  await supabase.from("events").insert({
    event_type: "reservation_rescheduled",
    order_id: order.id,
    customer_id: order.customer_id ?? null,
    properties: {
      from_date: fromDate,
      from_slot: fromSlot,
      to_date: reservedDate,
      to_slot: timeSlot,
      job_action: jobAction
    }
  });

  return ok({
    orderId: order.id,
    orderStatus,
    reservation: {
      id: reservation.id,
      reservedDate,
      timeSlot
    },
    jobAction
  });
}
