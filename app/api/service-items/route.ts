import { ok } from "@/lib/api-response";
import { getAllServiceItems } from "@/lib/service-items";
import { hasSupabaseEnv } from "@/lib/supabase";

export const revalidate = 3600;

export async function GET() {
  const items = await getAllServiceItems();

  return ok(
    {
      source: hasSupabaseEnv() ? "database_or_cached_fallback" : "fallback",
      items
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
      }
    }
  );
}
