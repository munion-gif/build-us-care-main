import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

function monthRange(monthText: string | null) {
  const fallback = new Date();
  const year = monthText?.match(/^\d{4}-\d{2}$/) ? Number(monthText.slice(0, 4)) : fallback.getFullYear();
  const month = monthText?.match(/^\d{4}-\d{2}$/) ? Number(monthText.slice(5, 7)) : fallback.getMonth() + 1;
  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+09:00`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start: start.toISOString(), end: end.toISOString(), label: `${year}-${String(month).padStart(2, "0")}` };
}

export async function GET(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { id } = await context.params;
  const technicianId = uuidSchema.safeParse(id);
  if (!technicianId.success) return fail("BAD_REQUEST", "Invalid technician id.", 400);

  const { searchParams } = new URL(request.url);
  const range = monthRange(searchParams.get("month"));
  const { data, error } = await getSupabaseAdmin()
    .from("jobs")
    .select("id,status,scheduled_at,orders(id,order_number,skus,homes(address_full))")
    .eq("technician_id", technicianId.data)
    .neq("status", "cancelled")
    .gte("scheduled_at", range.start)
    .lt("scheduled_at", range.end)
    .order("scheduled_at", { ascending: true });

  if (error) return fail("internal_error", error.message, 500);

  return ok({ month: range.label, jobs: data ?? [] });
}
