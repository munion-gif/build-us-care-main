import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicAppConfig } from "@/lib/app-config";
import { measure } from "@/lib/perf";
import { CANONICAL_SERVICE_CODES, SERVICE_ALIASES, SERVICE_NAME_BY_CODE, canonicalServiceCode } from "@/lib/service-catalog";
import { getMaterialsBySku, getServiceItem } from "@/lib/service-items";
import type { QuotePreset } from "@/lib/quote-preset";
import { QuoteDetailClient } from "./quote-detail-client";

type QuotePageProps = {
  params: Promise<{ serviceCode: string }>;
};

export const revalidate = 300;
export const dynamicParams = false;

const SITE_NAME = "Build us Care";
const PUBLIC_QUOTE_CODE_SET = new Set<string>(CANONICAL_SERVICE_CODES);
const PUBLIC_QUOTE_PARAM_CODES = Array.from(
  new Set([
    ...CANONICAL_SERVICE_CODES,
    ...Object.values(SERVICE_ALIASES)
      .flat()
      .filter((serviceCode) => PUBLIC_QUOTE_CODE_SET.has(canonicalServiceCode(serviceCode)))
  ])
);

const defaultPreset: QuotePreset = {
  source: "web",
  product: "standard",
  addons: []
};

export function generateStaticParams() {
  return PUBLIC_QUOTE_PARAM_CODES.map((serviceCode) => ({ serviceCode }));
}

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://builduscare.co.kr").replace(/\/$/, "");
}

function resolvePublicQuoteCode(serviceCode: string) {
  const publicServiceCode = canonicalServiceCode(serviceCode);
  return PUBLIC_QUOTE_CODE_SET.has(publicServiceCode) ? publicServiceCode : null;
}

export async function generateMetadata({ params }: QuotePageProps): Promise<Metadata> {
  const { serviceCode } = await params;
  const publicServiceCode = resolvePublicQuoteCode(serviceCode);

  if (!publicServiceCode) {
    return {
      title: `견적 | ${SITE_NAME}`,
      robots: { index: false, follow: false }
    };
  }

  const serviceName = SERVICE_NAME_BY_CODE[publicServiceCode] ?? "교체 서비스";
  const title = `${serviceName} 견적 | ${SITE_NAME}`;
  const description = `${serviceName} 제품 호환 여부와 제품가, 시공비를 먼저 확인하고 방문 예약까지 진행하세요.`;
  const url = `${getSiteUrl()}/quote/${publicServiceCode}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "website"
    }
  };
}

export default async function QuotePage({ params }: QuotePageProps) {
  const { serviceCode } = await params;
  const publicServiceCode = resolvePublicQuoteCode(serviceCode);

  if (!publicServiceCode) {
    notFound();
  }

  const service = await measure("quote.service.fetchService", () => getServiceItem(publicServiceCode));

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
