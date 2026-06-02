import { notFound } from "next/navigation";
import { getPublicAppConfig } from "@/lib/app-config";
import { measure } from "@/lib/perf";
import { CANONICAL_SERVICE_CODES } from "@/lib/service-catalog";
import { getMaterialsBySku, getServiceItem } from "@/lib/service-items";
import type { QuotePreset } from "@/lib/quote-preset";
import { QuoteDetailClient } from "./quote-detail-client";

type QuotePageProps = {
  params: Promise<{ serviceCode: string }>;
};

export const revalidate = 300;

const defaultPreset: QuotePreset = {
  source: "web",
  product: "standard",
  addons: []
};

export function generateStaticParams() {
  return CANONICAL_SERVICE_CODES.map((serviceCode) => ({ serviceCode }));
}

export default async function QuotePage({ params }: QuotePageProps) {
  const { serviceCode } = await params;
  const service = await measure("quote.service.fetchService", () => getServiceItem(serviceCode));

  if (!service) {
    notFound();
  }

  const materialSkus = [service.standard_material_sku, service.premium_material_sku].filter(Boolean) as string[];
  const [materials, appConfig] = await Promise.all([
    measure("quote.service.fetchMaterials", () => getMaterialsBySku(materialSkus)),
    getPublicAppConfig()
  ]);

  return <QuoteDetailClient service={service} materials={materials} preset={defaultPreset} kakaoUrl={appConfig.kakaoChannelUrl} />;
}
