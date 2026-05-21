import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { validationError } from "@/lib/errors";
import { insertJobStatusLog } from "@/lib/jobs";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

function asArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function activeReservation(reservations: any[]) {
  return reservations
    .filter((reservation) => reservation.status !== "cancelled")
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0] ?? null;
}

function activeAssignedJob(jobs: any[]) {
  return jobs
    .filter((job) => job.status !== "cancelled" && (job.technician_id || job.assigned_technician_name))
    .sort((a, b) => String(b.scheduled_at ?? b.created_at ?? "").localeCompare(String(a.scheduled_at ?? a.created_at ?? "")))[0] ?? null;
}

function kstDateText(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function slotFromScheduledAt(value: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(new Date(value)));
  return hour < 13 ? "morning" : "afternoon";
}

function scheduledAtForSlot(dateText: string, slot: string) {
  const time = slot === "afternoon" ? "13:00:00" : "09:00:00";
  return `${dateText}T${time}+09:00`;
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://builduscare.co.kr";
}

function slotLabel(slot: string) {
  if (slot === "morning") return "오전";
  if (slot === "afternoon") return "오후";
  return "종일";
}

export async function POST(request: Request, context: Context) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/orders/:id/confirm-reservation", method: "POST", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }

  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required.", 500);
  }

  const { id } = await context.params;
  const orderId = uuidSchema.safeParse(id);
  if (!orderId.success) return validationError(orderId.error, "Invalid order id.");

  const supabase = getSupabaseAdmin();
  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("id,status,order_number,access_token,customers(name,phone),reservations(*),jobs(*)")
    .eq("id", orderId.data)
    .maybeSingle();

  if (readError) return fail("internal_error", readError.message, 500);
  if (!order) return fail("not_found", "주문을 찾을 수 없습니다.", 404);
  if (!["paid", "scheduled"].includes(String(order.status))) {
    return fail("ORDER_NOT_CONFIRMABLE", "결제 완료 이후 주문만 예약 확정할 수 있습니다.", 409);
  }

  const job = activeAssignedJob(asArray(order.jobs));
  if (!job) {
    return fail("JOB_REQUIRED", "예약 확정 전 담당 기사를 먼저 배정해주세요.", 409);
  }

  const reservation = activeReservation(asArray(order.reservations));
  const reservedDate = reservation?.reserved_date ?? (job.scheduled_at ? kstDateText(job.scheduled_at) : null);
  const timeSlot = reservation?.time_slot ?? (job.scheduled_at ? slotFromScheduledAt(job.scheduled_at) : null);
  if (!reservedDate || !timeSlot) {
    return fail("RESERVATION_REQUIRED", "예약 날짜와 시간대를 먼저 입력해주세요.", 409);
  }

  const scheduledAt = job.scheduled_at ?? scheduledAtForSlot(reservedDate, timeSlot);
  const updates: Array<PromiseLike<any>> = [
    supabase
      .from("jobs")
      .update({
        status: "scheduled",
        scheduled_at: scheduledAt,
        scheduled_date: reservedDate
      })
      .eq("id", job.id),
    insertJobStatusLog(supabase, job.id, job.status ?? null, "scheduled", "관리자 예약 확정"),
    supabase.from("orders").update({ status: "scheduled" }).eq("id", orderId.data)
  ];

  if (reservation) {
    updates.push(
      supabase
        .from("reservations")
        .update({
          reserved_date: reservedDate,
          time_slot: timeSlot,
          status: "confirmed",
          notes: "관리자 예약 확정"
        })
        .eq("id", reservation.id)
    );
  } else {
    updates.push(
      supabase.from("reservations").insert({
        order_id: orderId.data,
        reserved_date: reservedDate,
        time_slot: timeSlot,
        status: "confirmed",
        notes: "관리자 예약 확정"
      })
    );
  }

  const results = await Promise.all(updates);
  const firstError = results.find((result: any) => result?.error)?.error;
  if (firstError) return fail("internal_error", firstError.message, 500);

  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  const technicianName = job.assigned_technician_name ?? "담당 기사";
  const statusUrl = order.access_token ? `${siteUrl()}/orders/${order.id}?accessToken=${order.access_token}` : `${siteUrl()}/orders/${order.id}`;
  await supabase.from("notifications").insert({
    order_id: orderId.data,
    job_id: job.id,
    channel: "kakao",
    template_code: "reservation_confirmed",
    recipient: customer?.phone ?? "unknown",
    send_status: "prepared",
    payload: {
      order_id: order.id,
      order_number: order.order_number,
      customer_name: customer?.name ?? "고객",
      reservation_date: reservedDate,
      time_slot: timeSlot,
      time_slot_label: slotLabel(timeSlot),
      scheduled_at: scheduledAt,
      technician_name: technicianName,
      status_url: statusUrl,
      message: `[빌드어스] 방문 예약이 확정되었습니다.\n주문번호: ${order.order_number}\n방문일정: ${reservedDate} ${slotLabel(timeSlot)}\n담당기사: ${technicianName}\n주문현황: ${statusUrl}`,
      dispatch_ready: false,
      dispatch_note: "Kakao/SMS provider is not connected yet. Keep as prepared until external dispatch is enabled."
    }
  });

  logOperation({ requestId, endpoint: "/api/admin/orders/:id/confirm-reservation", method: "POST", adminKeyId, identifiers: { order_id: orderId.data, job_id: job.id }, success: true });
  return ok({ order_status: "scheduled", job_status: "scheduled", notification_status: "prepared" });
}
