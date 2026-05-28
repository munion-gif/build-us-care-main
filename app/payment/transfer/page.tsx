import { Suspense } from "react";
import { TransferPaymentClient } from "./transfer-payment-client";

export default function TransferPaymentPage() {
  return (
    <Suspense fallback={null}>
      <TransferPaymentClient />
    </Suspense>
  );
}
