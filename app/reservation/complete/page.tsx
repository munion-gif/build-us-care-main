import { ReservationFlowClient } from "@/components/builduscare/ReservationFlowClient";

export const metadata = {
  title: "Build us Care",
  description: "집 전체가 아니라, 바꿀 수 있는 것부터."
};

export default function ReservationCompletePage() {
  return <ReservationFlowClient step="complete" />;
}
