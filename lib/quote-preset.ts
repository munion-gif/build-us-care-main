import { sourceContextFromSearchParams } from "@/lib/traffic-source";

export type QuotePreset = {
  region?: string;
  source: "kakao" | "web" | "instagram" | "phone";
  campaign?: string;
  product: "standard" | "premium";
  addons: string[];
  banner?: string;
};

function readParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export function parseQuotePreset(searchParams: Record<string, string | string[] | undefined>): QuotePreset {
  const sourceContext = sourceContextFromSearchParams(searchParams);
  const source =
    sourceContext.trafficSource === "kakao" || sourceContext.trafficSource === "instagram" || sourceContext.trafficSource === "phone"
      ? sourceContext.trafficSource
      : "web";
  const rawProduct = readParam(searchParams, "product");
  const product = rawProduct === "premium" ? "premium" : "standard";
  const region = readParam(searchParams, "region") || undefined;
  const campaign = readParam(searchParams, "campaign") || readParam(searchParams, "utm_campaign") || undefined;
  const addons = (readParam(searchParams, "addons") ?? "")
    .split(",")
    .map((addon) => addon.trim())
    .filter(Boolean);

  let banner: string | undefined;
  if (source === "kakao") banner = "카톡 상담으로 연결된 견적이에요";
  else if (source === "instagram") banner = "Instagram에서 보고 오셨다면 사진과 기본 정보만 남겨도 상담을 시작할 수 있어요";
  else if (region && !sourceContext.source) banner = `${regionLabel(region)} 지역 기준 예상 견적이에요`;

  return { region, source, campaign, product, addons, banner };
}

export function regionLabel(region: string) {
  const labels: Record<string, string> = {
    suwon: "수원",
    yongin: "용인",
    seongnam: "성남"
  };
  return labels[region] ?? region;
}
