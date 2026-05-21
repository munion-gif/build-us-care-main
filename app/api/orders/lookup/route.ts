import { fail, ok } from "@/lib/api-response";
import { readJson } from "@/lib/errors";
import { formatServiceName } from "@/lib/format";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

const attempts = new Map<string, number[]>();

function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function limited(key: string) {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < 5 * 60 * 1000);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > 3;
}

function asArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function firstServiceCode(order: any) {
  const sku = Array.isArray(order?.skus) ? order.skus[0] : null;
  return sku?.service_type_code ?? sku?.sku ?? order?.service_type_code;
}

function latestReservation(order: any) {
  return asArray(order?.reservations)
    .filter((reservation) => reservation.status !== "cancelled")
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0] ?? null;
}

function latestJob(order: any) {
  return asArray(order?.jobs)
    .filter((job) => job.status !== "cancelled")
    .sort((a, b) => String(b.scheduled_at ?? b.created_at ?? "").localeCompare(String(a.scheduled_at ?? a.created_at ?? "")))[0] ?? null;
}

function latestPayment(order: any) {
  return asArray(order?.payments)
    .sort((a, b) => String(b.paid_at ?? b.approved_at ?? b.created_at ?? "").localeCompare(String(a.paid_at ?? a.approved_at ?? a.created_at ?? "")))[0] ?? null;
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const body = await readJson(request);
  const name = normalizeName(body?.name);
  const phone = normalizePhone(body?.phone);
  if (name.length < 1) return fail("BAD_REQUEST", "이름을 입력해주세요.", 400);
  if (phone.length < 8) return fail("BAD_REQUEST", "전화번호를 다시 확인해주세요.", 400);
  if (limited(`${name}:${phone}`)) return fail("RATE_LIMITED", "요청이 많습니다. 5분 뒤 다시 시도해주세요.", 429);

  const supabase = getSupabaseAdmin();
  const { data: customers, error: customerError } = await supabase
    .from("customers")
    .select("id,name")
    .eq("phone", phone)
    .ilike("name", name);
  if (customerError) return fail("internal_error", customerError.message, 500);
  if (!customers?.length) {
    return ok({ orders: [], message: "일치하는 주문을 찾지 못했어요. 이름과 전화번호를 다시 확인해주세요." });
  }

  const customerIds = customers.map((customer) => customer.id);
  const { data: orders, error: orderError } = await supabase
    .from("orders")
    .select(
      `
      id,order_number,access_token,status,created_at,service_type_code,skus,
      payments(id,status,paid_at,approved_at,created_at),
      reservations(id,reserved_date,time_slot,status,created_at),
      jobs(id,status,scheduled_at,created_at)
    `
    )
    .in("customer_id", customerIds)
    .order("created_at", { ascending: false })
    .limit(20);

  if (orderError) return fail("internal_error", orderError.message, 500);
  if (!orders?.length) {
    return ok({ orders: [], message: "일치하는 주문을 찾지 못했어요. 이름과 전화번호를 다시 확인해주세요." });
  }

  const origin = new URL(request.url).origin;
  const results = orders
    .filter((order: any) => order.access_token)
    .map((order: any) => {
      const reservation = latestReservation(order);
      const job = latestJob(order);
      const payment = latestPayment(order);
      const serviceCode = firstServiceCode(order);
      return {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        createdAt: order.created_at,
        serviceName: formatServiceName(serviceCode),
        serviceCode,
        paymentStatus: payment?.status ?? null,
        isPaid: payment?.status === "done" || ["paid", "scheduled", "in_progress", "completed", "done", "warranty"].includes(String(order.status)),
        reservation: reservation ? {
          reservedDate: reservation.reserved_date,
          timeSlot: reservation.time_slot,
          status: reservation.status
        } : null,
        jobStatus: job?.status ?? null,
        link: `${origin}/orders/${order.id}?accessToken=${order.access_token}`
      };
    });

  if (results[0]?.id) {
    await supabase.from("notifications").insert({
      order_id: results[0].id,
      channel: "mock",
      template_code: "order_status_lookup",
      recipient: phone,
      send_status: "queued",
      payload: { lookup: "name_phone", order_count: results.length }
    });
  }

  return ok({
    orders: results,
    message: results.length > 0 ? "조회된 주문을 최신순으로 보여드릴게요." : "주문 현황 링크를 찾지 못했습니다. 상담 채널로 문의해주세요."
  });
}
