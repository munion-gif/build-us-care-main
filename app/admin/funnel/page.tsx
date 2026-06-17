import AdminFunnelClient, { type FunnelResponse } from "./funnel-client";
import { buildAdminFunnelReport } from "@/lib/admin-funnel";
import { hasSupabaseEnv } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default function AdminFunnelPage() {
  const localMode = !hasSupabaseEnv();
  let initialData: FunnelResponse | null = null;

  if (localMode) {
    const report = buildAdminFunnelReport([]);
    initialData = {
      period: "7d",
      steps: report.steps,
      channels: report.channels,
      localMode: true
    };
  }

  return <AdminFunnelClient initialData={initialData} initialLocalMode={localMode} />;
}
