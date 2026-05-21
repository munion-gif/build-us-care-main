import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { insertJobStatusLog } from "@/lib/jobs";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { orderStatusInputSchema, uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

const patchSchema = z.object({
  status: orderStatusInputSchema.optional(),
  customer: z.object({
    name: z.string().trim().min(1).max(80).optional(),
    phone: z.string().trim().min(8).max(20).optional()
  }).optional(),
  home: z.object({
    address_full: z.string().trim().min(1).max(300).optional(),
    address_dong: z.string().trim().min(1).max(120).optional(),
    address_apt: z.string().trim().max(120).nullable().optional()
  }).optional(),
  order: z.object({
    special_requests: z.string().trim().max(2000).nullable().optional()
  }).optional(),
  reservation: z.object({
    reserved_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time_slot: z.enum(["morning", "afternoon", "all_day"])
  }).optional(),
  warranty: z.object({
    id: z.string().uuid(),
    status: z.string().trim().min(1).max(40).optional(),
    responsibility: z.string().trim().max(120).nullable().optional(),
    resolved: z.boolean().optional()
  }).optional()
}).strict();

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function scheduledAtForSlot(dateText: string, slot: "morning" | "afternoon" | "all_day") {
  const time = slot === "afternoon" ? "13:00:00" : "09:00:00";
  return `${dateText}T${time}+09:00`;
}

function asArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function primaryActiveReservation(reservations: any[]) {
  return reservations
    .filter((reservation) => reservation.status !== "cancelled")
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0] ?? null;
}

function primaryActiveJob(jobs: any[]) {
  return jobs
    .filter((job) => job.status !== "cancelled")
    .sort((a, b) => String(b.scheduled_at ?? b.created_at ?? "").localeCompare(String(a.scheduled_at ?? a.created_at ?? "")))[0] ?? null;
}

export async function PATCH(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { id } = await context.params;
  const orderId = uuidSchema.safeParse(id);
  if (!orderId.success) return validationError(orderId.error, "Invalid order id.");

  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error, "수정할 값을 다시 확인해주세요.");

  const supabase = getSupabaseAdmin();
  const { data: current, error: readError } = await supabase
    .from("orders")
    .select("id,status,customer_id,home_id,customers(id),homes(id),reservations(*),jobs(*)")
    .eq("id", orderId.data)
    .maybeSingle();

  if (readError) return fail("internal_error", readError.message, 500);
  if (!current) return fail("not_found", "주문을 찾을 수 없습니다.", 404);

  const updates: Array<PromiseLike<any>> = [];

  if (parsed.data.customer) {
    const customerPatch: Record<string, string> = {};
    if (parsed.data.customer.name !== undefined) customerPatch.name = parsed.data.customer.name;
    if (parsed.data.customer.phone !== undefined) customerPatch.phone = normalizePhone(parsed.data.customer.phone);
    if (Object.keys(customerPatch).length) {
      updates.push(supabase.from("customers").update(customerPatch).eq("id", current.customer_id));
    }
  }

  if (parsed.data.home) {
    const homePatch: Record<string, string | null> = {};
    if (parsed.data.home.address_full !== undefined) homePatch.address_full = parsed.data.home.address_full;
    if (parsed.data.home.address_dong !== undefined) homePatch.address_dong = parsed.data.home.address_dong;
    if (parsed.data.home.address_apt !== undefined) homePatch.address_apt = parsed.data.home.address_apt || null;
    if (Object.keys(homePatch).length) {
      if (current.home_id) {
        updates.push(supabase.from("homes").update(homePatch).eq("id", current.home_id));
      } else {
        const customerPatch: Record<string, string | null> = {};
        if (homePatch.address_full !== undefined) customerPatch.address_full = homePatch.address_full;
        if (homePatch.address_dong !== undefined) customerPatch.address_dong = homePatch.address_dong;
        if (homePatch.address_apt !== undefined) customerPatch.address_apt = homePatch.address_apt;
        if (Object.keys(customerPatch).length) updates.push(supabase.from("customers").update(customerPatch).eq("id", current.customer_id));
      }
    }
  }

  const orderPatch: Record<string, string | null> = {};
  if (parsed.data.status) orderPatch.status = parsed.data.status;
  if (parsed.data.order?.special_requests !== undefined) orderPatch.special_requests = parsed.data.order.special_requests || null;
  if (Object.keys(orderPatch).length) {
    updates.push(supabase.from("orders").update(orderPatch).eq("id", orderId.data));
  }

  if (parsed.data.reservation) {
    const jobs = asArray(current.jobs);
    const activeJob = primaryActiveJob(jobs);
    if (["in_progress", "done", "inspected"].includes(String(activeJob?.status))) {
      return fail("JOB_ALREADY_STARTED", "시공이 시작된 주문은 예약을 관리자 화면에서 변경할 수 없습니다.", 409);
    }

    const reservations = asArray(current.reservations);
    const activeReservation = primaryActiveReservation(reservations);
    const reservationPatch = {
      reserved_date: parsed.data.reservation.reserved_date,
      time_slot: parsed.data.reservation.time_slot,
      status: "confirmed",
      notes: "관리자 예약 수정"
    };

    if (activeReservation) {
      updates.push(supabase.from("reservations").update(reservationPatch).eq("id", activeReservation.id));
    } else {
      updates.push(supabase.from("reservations").insert({ order_id: orderId.data, ...reservationPatch }));
    }

    if (activeJob) {
      const nextScheduledAt = scheduledAtForSlot(parsed.data.reservation.reserved_date, parsed.data.reservation.time_slot);
      const nextJobStatus = String(current.status) === "scheduled" || String(activeJob.status) === "scheduled" ? "scheduled" : activeJob.status ?? "assigned";
      updates.push(
        supabase
          .from("jobs")
          .update({
            scheduled_at: nextScheduledAt,
            scheduled_date: parsed.data.reservation.reserved_date,
            status: nextJobStatus
          })
          .eq("id", activeJob.id)
      );
      updates.push(insertJobStatusLog(supabase, activeJob.id, activeJob.status ?? null, nextJobStatus, "관리자 예약 수정"));
    }

    if (!orderPatch.status && ["paid", "scheduled"].includes(String(current.status))) {
      updates.push(supabase.from("orders").update({ status: current.status }).eq("id", orderId.data));
    }
  }

  if (parsed.data.warranty) {
    const warrantyPatch: Record<string, string | null> = {};
    if (parsed.data.warranty.status !== undefined) warrantyPatch.status = parsed.data.warranty.status;
    if (parsed.data.warranty.responsibility !== undefined) warrantyPatch.responsibility = parsed.data.warranty.responsibility || null;
    if (parsed.data.warranty.resolved !== undefined) {
      warrantyPatch.resolved_at = parsed.data.warranty.resolved ? new Date().toISOString() : null;
      if (parsed.data.warranty.resolved && !warrantyPatch.status) warrantyPatch.status = "resolved";
    }
    if (Object.keys(warrantyPatch).length) {
      updates.push(supabase.from("warranty_cases").update(warrantyPatch).eq("id", parsed.data.warranty.id).eq("order_id", orderId.data));
    }
  }

  const results = await Promise.all(updates);
  const firstError = results.find((result: any) => result?.error)?.error;
  if (firstError) return fail("internal_error", firstError.message, 500);

  await supabase.from("events").insert({
    event_type: "admin_order_updated",
    order_id: orderId.data,
    customer_id: current.customer_id,
    properties: {
      actor: "admin",
      sections: Object.keys(parsed.data)
    }
  });

  const { data, error } = await supabase
    .from("orders")
    .select("*, customers(*), homes(*), jobs(*, technicians(*)), reservations(*), warranty_cases(*)")
    .eq("id", orderId.data)
    .single();

  if (error) return fail("internal_error", error.message, 500);
  return ok({ order: data });
}
