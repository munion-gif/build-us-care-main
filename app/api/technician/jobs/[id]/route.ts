import { fail, ok } from "@/lib/api-response";
import { formatServiceName } from "@/lib/format";
import { ORDER_PHOTO_VIEW_EXPIRES_IN, ORDER_PHOTOS_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { canRevealJobContact, maskAddress, maskName, maskPhone, readTechnicianJobOrForbidden, requireTechnician } from "@/lib/technician-auth";
import { uuidSchema } from "@/lib/validation";
import { validationError } from "@/lib/errors";

type Context = {
  params: Promise<{ id: string }>;
};

function firstServiceCode(order: any) {
  const first = Array.isArray(order?.skus) ? order.skus[0] : null;
  return String(first?.sku ?? first?.service_type_code ?? order?.service_type_code ?? "");
}

export async function GET(request: Request, context: Context) {
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { id } = await context.params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return validationError(parsed.error, "Invalid job id.");

  const supabase = getSupabaseAdmin();
  const { technician, response } = await requireTechnician(supabase, request);
  if (response) return response;

  const job = await readTechnicianJobOrForbidden(supabase, parsed.data, technician.id);
  if (!job) return fail("not_found", "Job not found.", 404);

  const order = Array.isArray(job.orders) ? job.orders[0] : job.orders;
  const home = Array.isArray(order?.homes) ? order.homes[0] : order?.homes;
  const customer = Array.isArray(order?.customers) ? order.customers[0] : order?.customers;
  const reveal = canRevealJobContact(job);
  const serviceCode = firstServiceCode(order);

  const signedMedia = await Promise.all(
    (job.media ?? []).map(async (media: any) => {
      const { data: signed } = await supabase.storage.from(ORDER_PHOTOS_BUCKET).createSignedUrl(media.file_path, ORDER_PHOTO_VIEW_EXPIRES_IN);
      return { ...media, viewUrl: signed?.signedUrl ?? null };
    })
  );

  return ok({
    job: {
      id: job.id,
      status: job.status,
      scheduled_at: job.scheduled_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      actual_minutes: job.actual_minutes,
      materials_used: job.materials_used ?? [],
      completion_notes: job.completion_notes,
      issues: job.issues,
      service_code: serviceCode,
      service_name: formatServiceName(serviceCode),
      order: {
        id: order?.id,
        order_number: order?.order_number,
        skus: order?.skus ?? []
      },
      home: {
        address_full: reveal ? home?.address_full : maskAddress(home?.address_full)
      },
      customer: {
        name: reveal ? customer?.name : maskName(customer?.name),
        phone: reveal ? customer?.phone : maskPhone(customer?.phone)
      },
      media: signedMedia
    },
    technician: { id: technician.id, name: technician.name }
  });
}
