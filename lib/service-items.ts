import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { FALLBACK_SERVICE_ITEMS } from "@/lib/constants";
import { CANONICAL_SERVICE_CODES, SUPPORTED_SERVICE_CODES } from "@/lib/service-catalog";

export type QuoteServiceItem = {
  service_type_code: string;
  display_name: string;
  base_price: number;
  estimated_minutes: number | null;
  category: string;
  standardizable: boolean;
  photo_guide: string | null;
  included_items: string[];
  excluded_items: string[];
  warranty_policy: string | null;
  standard_material_sku: string | null;
  premium_material_sku: string | null;
  addon_skus: string[];
  metadata?: Record<string, unknown>;
};

export type MaterialItem = {
  sku: string;
  name: string;
  category: string;
  retail_price: number;
};

const STANDARDIZABLE_CODES = SUPPORTED_SERVICE_CODES;

const FALLBACK_GUIDES: Record<string, string> = {
  toilet_replace: "변기 전체 / 문제 부위 / 배관·규격이 보이는 사진",
  faucet_replace: "수전 전체 / 하부 배관 / 싱크대 아래 연결부 사진",
  kitchen_faucet: "수전 전체 / 하부 배관 / 싱크대 아래 연결부 사진",
  light_replace: "등기구 전체 / 스위치 / 천장 고정부 사진",
  outlet_replace: "콘센트 정면 / 주변 벽면 / 차단기 위치 사진",
  bidet_install: "변기 전체 / 급수 밸브 / 콘센트 위치 사진",
  door_handle: "문 전체 / 도어핸들 앞뒤 / 잠금장치 측면 사진",
  ventilator_replace: "환풍기 전체 / 천장 타공부 / 전원 스위치 사진",
  bath_fan: "환풍기 전체 / 천장 타공부 / 전원 스위치 사진"
};

function asStringArray(value: unknown, fallback: string[] = []) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : fallback;
}

function normalizeServiceItem(row: any): QuoteServiceItem {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    service_type_code: row.service_type_code,
    display_name: row.display_name,
    base_price: Number(row.base_price ?? 0),
    estimated_minutes: row.estimated_minutes ?? null,
    category: row.category ?? (metadata.category as string | undefined) ?? "service",
    standardizable: row.standardizable ?? STANDARDIZABLE_CODES.has(row.service_type_code),
    photo_guide: row.photo_guide ?? FALLBACK_GUIDES[row.service_type_code] ?? "전체 사진 / 문제 부위 / 주변 환경 사진",
    included_items: asStringArray(row.included_items, ["기존 철거", "신규 설치", "작동 테스트", "1년 A/S"]),
    excluded_items: asStringArray(row.excluded_items),
    warranty_policy: row.warranty_policy ?? "시공 하자 1년 무상 A/S",
    standard_material_sku: row.standard_material_sku ?? null,
    premium_material_sku: row.premium_material_sku ?? null,
    addon_skus: asStringArray(row.addon_skus),
    metadata
  };
}

export async function getServiceItem(serviceCode: string) {
  if (!hasSupabaseEnv()) return getFallbackServiceItem(serviceCode);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("service_items")
    .select("*")
    .eq("service_type_code", serviceCode)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return getFallbackServiceItem(serviceCode);
  return normalizeServiceItem(data);
}

export async function getMaterialsBySku(skus: string[]) {
  if (!hasSupabaseEnv() || skus.length === 0) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("materials")
    .select("sku,name,category,retail_price")
    .in("sku", skus)
    .eq("is_active", true);

  if (error || !data) return [];
  return data.map((row) => ({
    sku: row.sku,
    name: row.name,
    category: row.category,
    retail_price: Number(row.retail_price ?? 0)
  })) satisfies MaterialItem[];
}

export async function getServiceAddons(serviceCode: string) {
  const service = await getServiceItem(serviceCode);
  if (!service) return [];
  return getMaterialsBySku(service.addon_skus);
}

const HOME_FALLBACK_ITEMS: QuoteServiceItem[] = [
  {
    service_type_code: "toilet_replace",
    display_name: "변기 교체",
    base_price: 80000,
    estimated_minutes: 120,
    category: "bathroom",
    standardizable: true,
    photo_guide: FALLBACK_GUIDES.toilet_replace,
    included_items: ["기존 철거", "신규 설치", "누수 테스트", "1년 A/S"],
    excluded_items: [],
    warranty_policy: "시공 하자 1년 무상 A/S",
    standard_material_sku: "toilet_standard",
    premium_material_sku: "toilet_premium",
    addon_skus: []
  },
  {
    service_type_code: "faucet_replace",
    display_name: "수전 교체",
    base_price: 59000,
    estimated_minutes: 60,
    category: "kitchen",
    standardizable: true,
    photo_guide: FALLBACK_GUIDES.faucet_replace,
    included_items: ["기존 철거", "신규 설치", "누수 테스트", "1년 A/S"],
    excluded_items: [],
    warranty_policy: "시공 하자 1년 무상 A/S",
    standard_material_sku: "faucet_standard",
    premium_material_sku: "faucet_premium",
    addon_skus: []
  },
  {
    service_type_code: "light_replace",
    display_name: "전등 교체",
    base_price: 48000,
    estimated_minutes: 40,
    category: "lighting",
    standardizable: true,
    photo_guide: FALLBACK_GUIDES.light_replace,
    included_items: ["기존 철거", "신규 설치", "점등 테스트", "1년 A/S"],
    excluded_items: [],
    warranty_policy: "시공 하자 1년 무상 A/S",
    standard_material_sku: "light_standard",
    premium_material_sku: "light_premium",
    addon_skus: []
  },
  {
    service_type_code: "outlet_replace",
    display_name: "콘센트 교체",
    base_price: 73000,
    estimated_minutes: 40,
    category: "electric",
    standardizable: true,
    photo_guide: FALLBACK_GUIDES.outlet_replace,
    included_items: ["기존 철거", "신규 설치", "전원 테스트", "1년 A/S"],
    excluded_items: [],
    warranty_policy: "시공 하자 1년 무상 A/S",
    standard_material_sku: "outlet_standard",
    premium_material_sku: "outlet_premium",
    addon_skus: []
  },
  {
    service_type_code: "door_handle",
    display_name: "도어핸들 교체",
    base_price: 35000,
    estimated_minutes: 30,
    category: "door",
    standardizable: true,
    photo_guide: FALLBACK_GUIDES.door_handle,
    included_items: ["기존 철거", "신규 설치", "잠금 테스트", "1년 A/S"],
    excluded_items: [],
    warranty_policy: "시공 하자 1년 무상 A/S",
    standard_material_sku: "handle_standard",
    premium_material_sku: "handle_premium",
    addon_skus: []
  },
  {
    service_type_code: "bidet_install",
    display_name: "비데 설치",
    base_price: 60000,
    estimated_minutes: 45,
    category: "bathroom",
    standardizable: true,
    photo_guide: FALLBACK_GUIDES.bidet_install,
    included_items: ["제품 설치", "급수 연결", "작동 테스트", "1년 A/S"],
    excluded_items: [],
    warranty_policy: "시공 하자 1년 무상 A/S",
    standard_material_sku: "bidet_standard",
    premium_material_sku: "bidet_premium",
    addon_skus: []
  },
  {
    service_type_code: "ventilator_replace",
    display_name: "환풍기 교체",
    base_price: 70000,
    estimated_minutes: 80,
    category: "bathroom",
    standardizable: true,
    photo_guide: FALLBACK_GUIDES.ventilator_replace,
    included_items: ["기존 철거", "신규 설치", "동작 테스트", "1년 A/S"],
    excluded_items: [],
    warranty_policy: "시공 하자 1년 무상 A/S",
    standard_material_sku: "ventilator_standard",
    premium_material_sku: "ventilator_premium",
    addon_skus: []
  }
];

const HOME_SERVICE_CODES = CANONICAL_SERVICE_CODES;

function getFallbackServiceItem(serviceCode: string) {
  if (!SUPPORTED_SERVICE_CODES.has(serviceCode)) return null;
  const legacyFallbackItems = FALLBACK_SERVICE_ITEMS.map((item) =>
    normalizeServiceItem({
      ...item,
      category: item.metadata?.category
    })
  ).filter((item) => SUPPORTED_SERVICE_CODES.has(item.service_type_code));
  const fallbackByCode = new Map(
    [...legacyFallbackItems, ...HOME_FALLBACK_ITEMS].map((item) => [item.service_type_code, item])
  );

  return fallbackByCode.get(serviceCode) ?? null;
}

export async function getAllServiceItems(): Promise<QuoteServiceItem[]> {
  if (!hasSupabaseEnv()) return HOME_FALLBACK_ITEMS;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("service_items")
    .select("*")
    .eq("is_active", true);

  if (error || !data) return HOME_FALLBACK_ITEMS;

  const byCode = new Map(data.map(normalizeServiceItem).map((item) => [item.service_type_code, item]));
  const fallbackByCode = new Map(HOME_FALLBACK_ITEMS.map((item) => [item.service_type_code, item]));

  return HOME_SERVICE_CODES.map((code) => byCode.get(code) ?? fallbackByCode.get(code)).filter(
    (item): item is QuoteServiceItem => Boolean(item)
  );
}
