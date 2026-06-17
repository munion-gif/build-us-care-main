import { ReservationFlowClient } from "@/components/builduscare/ReservationFlowClient";

type ReservationInfoPageProps = {
  searchParams: Promise<{ orderId?: string; orderNumber?: string; name?: string; phone?: string }>;
};

export const metadata = {
  title: "Build us Care",
  description: "집 전체가 아니라, 바꿀 수 있는 것부터."
};

export default async function ReservationInfoPage({ searchParams }: ReservationInfoPageProps) {
  const query = await searchParams;
  return (
    <ReservationFlowClient
      step="info"
      initial={{
        orderId: query.orderId ?? "",
        orderNumber: query.orderNumber ?? "",
        customerName: query.name ?? "",
        phone: query.phone ?? ""
      }}
    />
  );
}
