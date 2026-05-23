import {
  BASIN_REPLACE_LABOR_PRICE,
  FAUCET_REPLACE_LABOR_PRICE,
  TOILET_REPLACE_LABOR_PRICE,
  VENTILATOR_REPLACE_LABOR_PRICE
} from "@/lib/constants";
import rawReplacementProducts from "./replacement-products.generated.json";
import { TOILET_PRODUCTS, TOILET_PRODUCT_SOURCE_NOTE } from "./toilet-products";

export type ReplacementProductServiceCode = "toilet_replace" | "basin_replace" | "faucet_replace" | "ventilator_replace";

export type ReplacementProduct = {
  id: string;
  serviceCode: ReplacementProductServiceCode;
  categoryId: string;
  categoryName: string;
  categorySummary: string;
  decisionHint: string;
  brand: string;
  model: string;
  sku: string;
  price: number | null;
  note: string;
  popular: boolean;
  image: string | null;
  sourceWorkbook?: string;
  sourceSheet: string;
  sourceRow: number;
};

export type ReplacementProductGroup = {
  id: string;
  name: string;
  summary: string;
  decisionHint: string;
  minPrice: number | null;
  count: number;
  popularCount: number;
  products: ReplacementProduct[];
};

export type ReplacementProductCatalog = {
  serviceCode: ReplacementProductServiceCode;
  title: string;
  customConsultLabel: string;
  sourceNote: string;
  minPrice: number;
  products: ReplacementProduct[];
  groups: ReplacementProductGroup[];
};

const SERVICE_ALIASES: Record<string, ReplacementProductServiceCode> = {
  toilet_replace: "toilet_replace",
  basin_replace: "basin_replace",
  faucet_replace: "faucet_replace",
  kitchen_faucet: "faucet_replace",
  ventilator_replace: "ventilator_replace",
  bath_fan: "ventilator_replace"
};

const SERVICE_LABELS: Record<ReplacementProductServiceCode, { title: string; customConsultLabel: string; sourceNote: string }> = {
  toilet_replace: {
    title: "양변기 종류와 제품가",
    customConsultLabel: "양변기",
    sourceNote: TOILET_PRODUCT_SOURCE_NOTE
  },
  basin_replace: {
    title: "세면대 종류와 제품가",
    customConsultLabel: "세면대",
    sourceNote: "2025년 제품 리스트 기준 제품가입니다. 실제 주문 금액은 시공비, 현장 부속, 배관 조건, 재고에 따라 확정됩니다."
  },
  faucet_replace: {
    title: "수전 종류와 제품가",
    customConsultLabel: "수전",
    sourceNote: "2025년 제품 리스트 기준 제품가입니다. 실제 주문 금액은 시공비, 연결 부속, 배관 조건, 재고에 따라 확정됩니다."
  },
  ventilator_replace: {
    title: "환풍기 종류와 제품가",
    customConsultLabel: "환풍기",
    sourceNote: "2025년 제품 리스트 기준 제품가입니다. 실제 주문 금액은 시공비, 전원·덕트 조건, 타공 크기, 재고에 따라 확정됩니다."
  }
};

const TOILET_AS_REPLACEMENT_PRODUCTS: ReplacementProduct[] = TOILET_PRODUCTS.map((product) => ({
  id: product.id,
  serviceCode: "toilet_replace",
  categoryId: product.categoryId,
  categoryName: product.categoryName,
  categorySummary: product.categorySummary,
  decisionHint: product.decisionHint,
  brand: product.brand,
  model: product.model,
  sku: product.sku,
  price: product.price,
  note: product.note,
  popular: product.popular,
  image: product.image,
  sourceSheet: product.sourceSheet,
  sourceRow: product.sourceRow
}));

const GENERATED_PRODUCTS = rawReplacementProducts as ReplacementProduct[];
export const REPLACEMENT_PRODUCTS: ReplacementProduct[] = [...TOILET_AS_REPLACEMENT_PRODUCTS, ...GENERATED_PRODUCTS];

function buildGroups(products: ReplacementProduct[]) {
  const byCategory = new Map<string, ReplacementProduct[]>();
  for (const product of products) {
    const current = byCategory.get(product.categoryId) ?? [];
    current.push(product);
    byCategory.set(product.categoryId, current);
  }

  return Array.from(byCategory.entries()).map(([categoryId, groupProducts]) => {
    const first = groupProducts[0];
    const prices = groupProducts.map((product) => product.price).filter((price): price is number => typeof price === "number");
    return {
      id: categoryId,
      name: first.categoryName,
      summary: first.categorySummary,
      decisionHint: first.decisionHint,
      minPrice: prices.length > 0 ? Math.min(...prices) : null,
      count: groupProducts.length,
      popularCount: groupProducts.filter((product) => product.popular).length,
      products: groupProducts
    } satisfies ReplacementProductGroup;
  });
}

export function productCatalogServiceCode(serviceCode: string): ReplacementProductServiceCode | null {
  return SERVICE_ALIASES[serviceCode] ?? null;
}

export function isProductSelectionService(serviceCode?: string | null) {
  return Boolean(serviceCode && productCatalogServiceCode(serviceCode));
}

export function getProductLaborPrice(serviceCode: string) {
  const canonical = productCatalogServiceCode(serviceCode);
  if (canonical === "toilet_replace") return TOILET_REPLACE_LABOR_PRICE;
  if (canonical === "faucet_replace") return FAUCET_REPLACE_LABOR_PRICE;
  if (canonical === "ventilator_replace") return VENTILATOR_REPLACE_LABOR_PRICE;
  if (canonical === "basin_replace") return BASIN_REPLACE_LABOR_PRICE;
  return 0;
}

export function getReplacementProductCatalog(serviceCode: string): ReplacementProductCatalog | null {
  const canonical = productCatalogServiceCode(serviceCode);
  if (!canonical) return null;
  const products = REPLACEMENT_PRODUCTS.filter((product) => product.serviceCode === canonical);
  if (products.length === 0) return null;
  const prices = products.map((product) => product.price).filter((price): price is number => typeof price === "number");
  const label = SERVICE_LABELS[canonical];
  return {
    serviceCode: canonical,
    title: label.title,
    customConsultLabel: label.customConsultLabel,
    sourceNote: label.sourceNote,
    minPrice: prices.length > 0 ? Math.min(...prices) : 0,
    products,
    groups: buildGroups(products)
  };
}

export function findReplacementProduct(serviceCode: string, productId: string | null | undefined) {
  if (!productId) return null;
  const canonical = productCatalogServiceCode(serviceCode);
  if (!canonical) return null;
  return REPLACEMENT_PRODUCTS.find((product) => product.serviceCode === canonical && product.id === productId) ?? null;
}

export function replacementProductSnapshot(product: ReplacementProduct) {
  return {
    id: product.id,
    serviceCode: product.serviceCode,
    category: product.categoryName,
    brand: product.brand,
    model: product.model,
    sku: product.sku,
    price: product.price
  };
}
