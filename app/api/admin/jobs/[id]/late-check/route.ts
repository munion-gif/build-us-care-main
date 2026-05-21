import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { id } = await context.params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return fail("bad_request", "Invalid job id.", 400);

  const supabase = getSupabaseAdmin();
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id,order_id,status,scheduled_at,assigned_technician_name,technicians(name,phone),orders(order_number)")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (jobError) return fail("internal_error", jobError.message, 500);
  if (!job) return fail("not_found", "Job not found.", 404);

  const technician = Array.isArray(job.technicians) ? job.technicians[0] : job.technicians;
  const order = Array.isArray(job.orders) ? job.orders[0] : job.orders;
  const recipient = technician?.phone ?? job.assigned_technician_name ?? "technician";
  const technicianName = technician?.name ?? job.assigned_technician_name ?? "기사 미배정";

  const { data: notification, error: notificationError } = await supabase
    .from("notifications")
    .insert({
      order_id: job.order_id,
      job_id: job.id,
      channel: "mock",
      template_code: "technician_late_check",
      recipient,
      send_status: "queued",
      payload: {
        order_number: order?.order_number ?? null,
        scheduled_at: job.scheduled_at,
        technician_name: technicianName,
        requested_by: "admin",
        reason: "scheduled_start_late"
      }
    })
    .select("*")
    .single();

  if (notificationError) return fail("internal_error", notificationError.message, 500);

  await supabase.from("events").insert({
    event_type: "job_late_check_requested",
    order_id: job.order_id,
    properties: {
      job_id: job.id,
      notification_id: notification.id,
      scheduled_at: job.scheduled_at,
      technician_name: technicianName
    }
  });

  return ok({ notification });
}
