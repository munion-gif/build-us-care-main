import { getOrdersOverview } from "@/lib/admin-orders-data";
import { OrdersClient } from "./orders-client";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const overview = await getOrdersOverview();
  return <OrdersClient overview={overview} />;
}
