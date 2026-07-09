import { SlotsCalendar } from "./slots-calendar-client";
import { hasSupabaseEnv } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default function AdminSlotsPage() {
  return <SlotsCalendar localMode={!hasSupabaseEnv()} />;
}
