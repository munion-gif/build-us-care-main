import { Suspense } from "react";
import { PaymentFailClient } from "./payment-fail-client";

export default function PaymentFailPage() {
  return (
    <Suspense fallback={null}>
      <PaymentFailClient />
    </Suspense>
  );
}
