import { AsRequestClient } from "@/components/builduscare/SupportRouteClients";

export const metadata = {
  title: "Build us Care",
  description: "집 전체가 아니라, 바꿀 수 있는 것부터."
};

export default function AsRequestPage() {
  return <AsRequestClient />;
}
