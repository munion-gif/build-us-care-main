import { getPublicAppConfig } from "@/lib/app-config";
import { measure } from "@/lib/perf";
import { OrderLookupClient } from "./order-lookup-client";

export const metadata = {
  title: "내 주문내역 조회 | Buildus Care",
  description: "예약 시 입력한 이름과 전화번호로 주문 목록을 확인하세요."
};

export default async function OrderLookupPage() {
  const appConfig = await measure("orders.lookup.fetchAppConfig", () => getPublicAppConfig());

  return <OrderLookupClient kakaoUrl={appConfig.kakaoChannelUrl} />;
}
