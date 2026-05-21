import { getAllServiceItems } from "@/lib/service-items";
import { ServicesClient } from "./services-client";

export const revalidate = 3600;

export default async function ServicesPage() {
  const services = await getAllServiceItems();

  return <ServicesClient services={services} />;
}
