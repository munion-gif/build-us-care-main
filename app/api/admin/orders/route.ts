import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { createRequestId, logOperation } from "@/lib/operational-log";
import { measure } from "@/lib/perf";
import { getServiceFilterCodes } from "@/lib/service-catalog";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export async function GET(request: Request) {
  const requestId = createRequestId();
  const adminKeyId = getAdminKeyId(request);
  const authError = requireAdmin(request);
  if (authError) {
    logOperation({ requestId, endpoint: "/api/admin/orders", method: "GET", adminKeyId, success: false, errorCode: "UNAUTHORIZED" });
    return authError;
  }

  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to list orders.", 500);
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const serviceCode = searchParams.get("service_code");
  const channel = searchParams.get("channel");
  const acquisitionSource = searchParams.get("acquisition_source");
  const urgency = searchParams.get("urgency");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const search = searchParams.get("search");
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);
  const from = searchParams.has("offset") ? offset : (page - 1) * limit;
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("orders")
    .select(
      `
      id, order_number, status, total_amount, created_at, channel, urgency, service_type_code, skus,
      customers(id,name,phone,acquisition_source),
      homes(id,address_full,building_type,size_pyung,year_built),
      quotes(id,version,total_final,accepted_at,created_at),
      reservations(id,reserved_date,time_slot,status,created_at),
      payments(id,status,amount,paid_at,approved_at,method,provider_status),
      jobs(id,status,technician_id,scheduled_at,technicians(id,name)),
      cancellations(id,status,refund_amount,refund_rate,requested_at)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  if (serviceCode) {
    const serviceCodes = getServiceFilterCodes(serviceCode);
    query = serviceCodes.length > 1 ? query.in("service_type_code", serviceCodes) : query.eq("service_type_code", serviceCode);
  }

  if (channel) {
    query = query.eq("channel", channel);
  }

  if (urgency) {
    query = query.eq("urgency", urgency);
  }

  if (acquisitionSource) {
    query = query.eq("customers.acquisition_source", acquisitionSource);
  }

  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }

  if (dateTo) {
    query = query.lte("created_at", dateTo);
  }

  if (search) {
    query = query.or(`order_number.ilike.%${search}%,customers.phone.ilike.%${search}%`);
  }

  const { data, error, count } = await measure("api.admin.orders.query", () => query);

  if (error) {
    logOperation({ requestId, endpoint: "/api/admin/orders", method: "GET", adminKeyId, success: false, errorCode: "INTERNAL_ERROR" });
    return fail("internal_error", error.message, 500);
  }

  logOperation({ requestId, endpoint: "/api/admin/orders", method: "GET", adminKeyId, success: true });
  return ok({ orders: data, pagination: { page, limit, offset: from, count: count ?? 0 } });
}
