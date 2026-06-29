import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

function dateParam(value: string | null, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function todayKst() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const fallbackDate = todayKst();
  const dateFrom = dateParam(searchParams.get("date_from"), fallbackDate);
  const dateTo = dateParam(searchParams.get("date_to"), dateFrom);

  if (!hasSupabaseEnv()) {
    return ok({ manualQuotes: [], localMode: true });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("manual_quotes")
    .select(
      `
      id,
      quote_number,
      customer_name,
      customer_phone,
      address_text,
      items,
      total_final,
      reserved_date,
      time_slot,
      converted_order_id,
      converted_at,
      created_at,
      updated_at
    `
    )
    .not("reserved_date", "is", null)
    .not("time_slot", "is", null)
    .is("converted_order_id", null)
    .gte("reserved_date", dateFrom)
    .lt("reserved_date", dateTo)
    .order("reserved_date", { ascending: true })
    .order("time_slot", { ascending: true })
    .limit(300);

  if (error) return fail("internal_error", error.message, 500);

  return ok({ manualQuotes: data ?? [], localMode: false });
}
