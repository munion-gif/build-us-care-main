import type { MetadataRoute } from "next";
import { BUILDUSCARE_CATEGORIES } from "@/lib/builduscare-public-routes";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://builduscare.co.kr";
  const lastModified = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/service`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/products`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/photo-check`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/order-lookup`, lastModified, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/terms`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/refund-policy`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/as-policy`, lastModified, changeFrequency: "yearly", priority: 0.2 }
  ];

  const productRoutes: MetadataRoute.Sitemap = BUILDUSCARE_CATEGORIES.map((category) => ({
    url: `${baseUrl}/products/${category.slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.8
  }));

  return [...staticRoutes, ...productRoutes];
}
