import { Suspense } from "react";
import { PaymentSuccessClient } from "./payment-success-client";

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={null}>
      <PaymentSuccessClient />
    </Suspense>
  );
}
