import { notFound } from "next/navigation";
import { HomeClient } from "../home-client";

type PublicRoutePageProps = {
  params: Promise<{ slug: string[] }>;
};

const exactRoutes = new Set(["service", "products", "photo-check", "order-lookup", "order-status", "quote-preview", "as-request"]);
const productRoutes = new Set(["toilet", "washbasin", "faucet", "bidet", "ventilation", "window-handle", "door-handle", "silicone", "bath-accessory", "detail"]);
const photoRoutes = new Set(["photos"]);
const reservationRoutes = new Set(["info", "schedule", "confirm", "complete"]);

function isBuildusCareRoute(slug: string[]) {
  const [first, second] = slug;
  if (!first) return true;
  if (exactRoutes.has(first) && slug.length === 1) return true;
  if (first === "products") return slug.length <= 3 && (!second || productRoutes.has(second));
  if (first === "photo-check") return slug.length <= 2 && (!second || photoRoutes.has(second));
  if (first === "reservation") return slug.length === 2 && reservationRoutes.has(second);
  return false;
}

export default async function PublicRoutePage({ params }: PublicRoutePageProps) {
  const { slug } = await params;
  if (!isBuildusCareRoute(slug ?? [])) notFound();
  return <HomeClient />;
}
