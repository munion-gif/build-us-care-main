import { fail, ok } from "@/lib/api-response";
import { formatServiceName } from "@/lib/format";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { maskAddress, requireTechnician } from "@/lib/technician-auth";

function firstServiceCode(order: any) {
  const first = Array.isArray(order?.skus) ? order.skus[0] : null;
  return String(first?.sku ?? first?.service_type_code ?? order?.service_type_code ?? "");
}

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required.", 500);
  }

  const supabase = getSupabaseAdmin();
  const { technician, response } = await requireTechnician(supabase, request);
  if (response) return response;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("jobs")
    .select(
      `
      *,
      orders (
        id,
        order_number,
        status,
        service_type_code,
        skus,
        homes (*)
      )
    `
    )
    .eq("technician_id", technician.id)
    .in("status", ["scheduled", "in_progress", "done"])
    .or(`scheduled_at.gte.${today.toISOString()},scheduled_at.is.null`)
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  if (error) return fail("internal_error", error.message, 500);

  const jobs = (data ?? []).map((job: any) => {
    const order = Array.isArray(job.orders) ? job.orders[0] : job.orders;
    const home = Array.isArray(order?.homes) ? order.homes[0] : order?.homes;
    const serviceCode = firstServiceCode(order);
    return {
      id: job.id,
      status: job.status,
      scheduled_at: job.scheduled_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      service_code: serviceCode,
      service_name: formatServiceName(serviceCode),
      order_number: order?.order_number ?? null,
      address_summary: maskAddress(home?.address_full)
    };
  });

  return ok({ technician: { id: technician.id, name: technician.name }, jobs });
}
