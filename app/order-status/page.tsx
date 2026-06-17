import { redirect } from "next/navigation";
import { OrderStatusDefault } from "@/components/builduscare/OrderStatusDefault";

type OrderStatusAliasPageProps = {
  searchParams: Promise<{ id?: string; orderId?: string; orderNumber?: string; name?: string; accessToken?: string }>;
};

export const metadata = {
  title: "Build us Care",
  description: "집 전체가 아니라, 바꿀 수 있는 것부터."
};

export default async function OrderStatusAliasPage({ searchParams }: OrderStatusAliasPageProps) {
  const query = await searchParams;
  const id = query.id ?? query.orderId;
  if (id) {
    const accessToken = query.accessToken ? `?accessToken=${encodeURIComponent(query.accessToken)}` : "";
    redirect(`/orders/${encodeURIComponent(id)}${accessToken}`);
  }
  return <OrderStatusDefault />;
}
