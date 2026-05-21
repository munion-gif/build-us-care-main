import { ok } from "@/lib/api-response";
import { FALLBACK_SERVICE_ITEMS } from "@/lib/constants";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const revalidate = 3600;

export async function GET() {
  if (!hasSupabaseEnv()) {
    return ok({
      source: "fallback",
      items: FALLBACK_SERVICE_ITEMS
    });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("service_items")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    return ok({
      source: "fallback_after_db_error",
      warning: error.message,
      items: FALLBACK_SERVICE_ITEMS
    });
  }

  return ok({
    source: "database",
    items: data
  });
}
