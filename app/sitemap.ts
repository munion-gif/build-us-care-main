import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://builduscare.co.kr";
  return [{ url: baseUrl, lastModified: new Date() }];
}
