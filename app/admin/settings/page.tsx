import { SettingsPanel } from "./settings-panel-client";
import { hasSupabaseEnv } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  return <SettingsPanel localMode={!hasSupabaseEnv()} />;
}
