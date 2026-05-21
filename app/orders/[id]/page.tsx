import { getPublicAppConfig } from "@/lib/app-config";
import { measure } from "@/lib/perf";
import { OrderStatusClient } from "./order-status-client";

type OrderStatusPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ accessToken?: string }>;
};

export default async function OrderStatusPage({ params, searchParams }: OrderStatusPageProps) {
  const [{ id }, query, appConfig] = await Promise.all([params, searchParams, measure("orders.status.fetchAppConfig", () => getPublicAppConfig())]);

  return <OrderStatusClient orderId={id} accessToken={query.accessToken ?? ""} kakaoUrl={appConfig.kakaoChannelUrl} servicePhone={appConfig.servicePhone} />;
}
