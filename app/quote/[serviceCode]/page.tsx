import { notFound } from "next/navigation";
import { getPublicAppConfig } from "@/lib/app-config";
import { measure } from "@/lib/perf";
import { getMaterialsBySku, getServiceItem } from "@/lib/service-items";
import { parseQuotePreset } from "@/lib/quote-preset";
import { QuoteDetailClient } from "./quote-detail-client";

type QuotePageProps = {
  params: Promise<{ serviceCode: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QuotePage({ params, searchParams }: QuotePageProps) {
  const { serviceCode } = await params;
  const resolvedSearchParams = await searchParams;
  const service = await measure("quote.service.fetchService", () => getServiceItem(serviceCode));

  if (!service) {
    notFound();
  }

  const preset = parseQuotePreset(resolvedSearchParams);
  const materialSkus = [service.standard_material_sku, service.premium_material_sku].filter(Boolean) as string[];
  const [materials, addons, appConfig] = await Promise.all([
    measure("quote.service.fetchMaterials", () => getMaterialsBySku(materialSkus)),
    measure("quote.service.fetchAddons", () => getMaterialsBySku(service.addon_skus)),
    getPublicAppConfig()
  ]);

  return <QuoteDetailClient service={service} materials={materials} addons={addons} preset={preset} kakaoUrl={appConfig.kakaoChannelUrl} />;
}
