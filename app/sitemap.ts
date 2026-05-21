import type { MetadataRoute } from "next";
import { getAllServiceItems } from "@/lib/service-items";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
  const services = await getAllServiceItems();
  const staticPaths = ["/", "/services", "/request/photo", "/cases"];
  return [
    ...staticPaths.map((path) => ({ url: `${baseUrl}${path}`, lastModified: new Date() })),
    ...services.map((service) => ({ url: `${baseUrl}/quote/${service.service_type_code}`, lastModified: new Date() }))
  ];
}
