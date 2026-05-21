import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { insertJobStatusLog } from "@/lib/jobs";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { createAdminJobSchema } from "@/lib/validation";

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function kstDateOnly(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function kstHour(value: string | Date) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(typeof value === "string" ? new Date(value) : value));
}

function slotFromScheduledAt(value: string | Date) {
  return kstHour(value) < 13 ? "morning" : "afternoon";
}

function kstDayUtcRange(dateText: string) {
  const start = new Date(`${dateText}T00:00:00+09:00`);
  const end = new Date(`${dateText}T00:00:00+09:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/jobs", method: "POST", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }

  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to create jobs.", 500);
  }

  const body = await readJson(request);
  const parsed = createAdminJobSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid job assignment request.");
  }

  const supabase = getSupabaseAdmin();
  const [{ data: order }, { data: technician }] = await Promise.all([
    supabase.from("orders").select("id,status").eq("id", parsed.data.order_id).maybeSingle(),
    supabase.from("technicians").select("id,name,is_active").eq("id", parsed.data.technician_id).maybeSingle()
  ]);

  if (!order) {
    return fail("not_found", "Order not found.", 404);
  }

  if (!technician) {
    return fail("not_found", "Technician not found.", 404);
  }

  if (!technician.is_active) {
    return fail("BAD_REQUEST", "Technician is not active.", 400);
  }

  if (!["paid", "scheduled"].includes(order.status)) {
    return fail("ORDER_NOT_ASSIGNABLE", "결제 완료된 주문만 기사 배정이 가능합니다.", 400);
  }

  const scheduledAt = new Date(parsed.data.scheduled_at);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    return fail("SCHEDULED_AT_PAST", "방문 시간은 현재 시각 이후로 선택해주세요.", 400);
  }

  const { data: currentJob } = await supabase
    .from("jobs")
    .select("*")
    .eq("order_id", parsed.data.order_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const workDate = kstDateOnly(scheduledAt);
  const workSlot = slotFromScheduledAt(scheduledAt);
  const range = kstDayUtcRange(workDate);
  const { data: technicianJobs, error: technicianJobsError } = await supabase
    .from("jobs")
    .select("id,scheduled_at,status")
    .eq("technician_id", parsed.data.technician_id)
    .not("scheduled_at", "is", null)
    .neq("status", "cancelled")
    .gte("scheduled_at", range.start)
    .lt("scheduled_at", range.end);

  if (technicianJobsError) {
    return fail("internal_error", technicianJobsError.message, 500);
  }

  const sameSlotAssignedCount = (technicianJobs ?? []).filter((job) => job.id !== currentJob?.id && slotFromScheduledAt(job.scheduled_at) === workSlot).length;
  if (sameSlotAssignedCount >= 1) {
    return fail("TECHNICIAN_OVERLOADED", "해당 기사는 이미 같은 시간대에 배정이 차 있습니다.", 409);
  }

  const nextJobStatus = order.status === "scheduled" ? "scheduled" : "assigned";
  const nextOrderStatus = order.status === "scheduled" ? "scheduled" : "paid";
  const payload = {
    order_id: parsed.data.order_id,
    technician_id: parsed.data.technician_id,
    assigned_technician_name: technician.name,
    scheduled_at: parsed.data.scheduled_at,
    scheduled_date: parsed.data.scheduled_at.slice(0, 10),
    expected_minutes: parsed.data.expected_minutes ?? 0,
    status: nextJobStatus
  };

  const query = currentJob
    ? supabase.from("jobs").update(payload).eq("id", currentJob.id)
    : supabase.from("jobs").insert(payload);

  const { data: job, error } = await query.select("*").single();

  if (error) {
    logOperation({ requestId, endpoint: "/api/admin/jobs", method: "POST", adminKeyId, success: false, errorCode: "INTERNAL_ERROR" });
    return fail("internal_error", error.message, 500);
  }

  await insertJobStatusLog(supabase, job.id, currentJob?.status ?? null, nextJobStatus, nextJobStatus === "scheduled" ? "관리자 기사 재배정" : "관리자 기사 배정");
  if (order.status !== nextOrderStatus) {
    await supabase.from("orders").update({ status: nextOrderStatus }).eq("id", parsed.data.order_id);
  }

  logOperation({ requestId, endpoint: "/api/admin/jobs", method: "POST", adminKeyId, identifiers: { job_id: job.id, order_id: parsed.data.order_id }, success: true });
  return ok({ job, created: !currentJob, synced_order_status: nextOrderStatus }, { status: currentJob ? 200 : 201 });
}

export async function GET(request: Request) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/jobs", method: "GET", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }

  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to list jobs.", 500);
  }

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id");
  const technicianId = searchParams.get("technician_id");
  const status = searchParams.get("status");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const limit = parseBoundedInt(searchParams.get("limit"), 50, 1, 100);
  const offset = parseBoundedInt(searchParams.get("offset"), 0, 0, 10000);
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("jobs")
    .select(
      `
      *,
      technicians (*),
      orders (
        id,
        order_number,
        status,
        total_amount,
        customers (*),
        homes (*),
        quotes (*)
      ),
      job_status_logs (*)
    `
      ,
      { count: "exact" }
    )
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (orderId) {
    query = query.eq("order_id", orderId);
  }

  if (technicianId) {
    query = query.eq("technician_id", technicianId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (dateFrom) {
    query = query.gte("scheduled_at", dateFrom);
  }

  if (dateTo) {
    query = query.lte("scheduled_at", dateTo);
  }

  const { data, error, count } = await query;

  if (error) {
    logOperation({ requestId, endpoint: "/api/admin/jobs", method: "GET", adminKeyId, success: false, errorCode: "INTERNAL_ERROR" });
    return fail("internal_error", error.message, 500);
  }

  logOperation({ requestId, endpoint: "/api/admin/jobs", method: "GET", adminKeyId, success: true });
  return ok({ jobs: data, pagination: { limit, offset, count: count ?? 0 } });
}
