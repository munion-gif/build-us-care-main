import { getDashboard } from "@/lib/admin-dashboard-data";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const d = await getDashboard();
  return <DashboardClient d={d} />;
}
