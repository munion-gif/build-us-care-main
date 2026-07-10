import { Suspense } from "react";
import OrdersClient from "./orders-new-client";

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div className="spin" />}>
      <OrdersClient />
    </Suspense>
  );
}
