import {
  BIDET_INSTALL_LABOR_PRICE,
  BASIN_REPLACE_LABOR_PRICE,
  DOOR_HANDLE_REPLACE_LABOR_PRICE,
  FAUCET_REPLACE_LABOR_PRICE,
  SASH_HANDLE_REPLACE_LABOR_PRICE,
  TOILET_REPLACE_LABOR_PRICE,
  VENTILATOR_REPLACE_LABOR_PRICE
} from "@/lib/constants";
import rawReplacementProducts from "./replacement-products.generated.json";
import { TOILET_PRODUCTS, TOILET_PRODUCT_SOURCE_NOTE } from "./toilet-products";

export type ReplacementProductServiceCode = "toilet_replace" | "basin_replace" | "faucet_replace" | "bidet_install" | "ventilator_replace" | "sash_handle" | "door_handle";

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
  size?: string;
  price: number | null;
  note: string;
  popular: boolean;
  isRecommended?: boolean;
  recommendLabel?: string;
  recommendDescription?: string;
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
  bidet_install: "bidet_install",
  ventilator_replace: "ventilator_replace",
  bath_fan: "ventilator_replace",
  sash_handle: "sash_handle",
  door_handle: "door_handle"
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
    sourceNote: "엑셀 제품 리스트 기준 제품가입니다. 실제 주문 금액은 시공비, 현장 부속, 배관 조건, 재고에 따라 확정됩니다."
  },
  faucet_replace: {
    title: "수전 종류와 제품가",
    customConsultLabel: "수전",
    sourceNote: "엑셀 제품 리스트 기준 제품가입니다. 실제 주문 금액은 시공비, 연결 부속, 배관 조건, 재고에 따라 확정됩니다."
  },
  bidet_install: {
    title: "비데 종류와 제품가",
    customConsultLabel: "비데",
    sourceNote: "엑셀 제품 리스트 기준 제품가입니다. 실제 주문 금액은 시공비, 급수 연결, 전원 조건, 재고에 따라 확정됩니다."
  },
  ventilator_replace: {
    title: "환풍기 종류와 제품가",
    customConsultLabel: "환풍기",
    sourceNote: "엑셀 제품 리스트 기준 제품가입니다. 실제 주문 금액은 시공비, 전원·덕트 조건, 타공 크기, 재고에 따라 확정됩니다."
  },
  sash_handle: {
    title: "샷시손잡이 종류와 제품가",
    customConsultLabel: "샷시손잡이",
    sourceNote: "엑셀 제품 리스트 기준 제품가입니다. 실제 주문 금액은 시공비, 기존 창호 규격, 잠금장치 호환, 재고에 따라 확정됩니다."
  },
  door_handle: {
    title: "도어핸들 종류와 제품가",
    customConsultLabel: "도어핸들",
    sourceNote: "엑셀 제품 리스트 기준 제품가입니다. 실제 주문 금액은 시공비, 기존 문 두께, 잠금장치 호환, 재고에 따라 확정됩니다."
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
  isRecommended: product.isRecommended,
  recommendLabel: product.recommendLabel,
  recommendDescription: product.recommendDescription,
  image: product.image,
  sourceSheet: product.sourceSheet,
  sourceRow: product.sourceRow
}));

const GENERATED_PRODUCTS = rawReplacementProducts as ReplacementProduct[];

function lowestPricedProduct(products: ReplacementProduct[]) {
  return products
    .filter((product) => typeof product.price === "number")
    .sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY))[0];
}

function highestPricedProduct(products: ReplacementProduct[]) {
  const sortedProducts = products
    .filter((product) => typeof product.price === "number")
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0));

  return sortedProducts.find((product) => product.image) ?? sortedProducts[0];
}

function firstUniqueProduct(products: ReplacementProduct[], usedIds: Set<string>, preferred?: ReplacementProduct) {
  if (preferred && !usedIds.has(preferred.id)) return preferred;
  return products.find((product) => !usedIds.has(product.id) && typeof product.price === "number") ?? products.find((product) => !usedIds.has(product.id));
}

function withRecommendationMetadata(products: ReplacementProduct[]) {
  const byService = new Map<string, ReplacementProduct[]>();
  for (const product of products) {
    const current = byService.get(product.serviceCode) ?? [];
    current.push(product);
    byService.set(product.serviceCode, current);
  }

  const recommendationById = new Map<string, { label: string; description: string }>();
  for (const serviceProducts of byService.values()) {
    const usedIds = new Set<string>();
    const explicit = serviceProducts.filter((product) => product.recommendLabel);

    for (const product of explicit) {
      usedIds.add(product.id);
      recommendationById.set(product.id, {
        label: product.recommendLabel ?? "추천",
        description: product.recommendDescription ?? "사진 확인 후 가장 먼저 검토할 만한 제품입니다."
      });
    }

    const valueProduct = firstUniqueProduct(serviceProducts, usedIds, lowestPricedProduct(serviceProducts));
    if (valueProduct) {
      usedIds.add(valueProduct.id);
      recommendationById.set(valueProduct.id, {
        label: "가성비",
        description: "제품가 부담을 낮추면서 기본 교체에 무난한 선택입니다."
      });
    }

    const popularProduct = firstUniqueProduct(
      serviceProducts,
      usedIds,
      serviceProducts.find((product) => product.popular && typeof product.price === "number")
    );
    if (popularProduct) {
      usedIds.add(popularProduct.id);
      recommendationById.set(popularProduct.id, {
        label: "인기",
        description: "선택 빈도와 가격 균형을 함께 보기 좋은 대표 모델입니다."
      });
    }

    const premiumProduct = firstUniqueProduct(serviceProducts, usedIds, highestPricedProduct(serviceProducts));
    if (premiumProduct) {
      recommendationById.set(premiumProduct.id, {
        label: "프리미엄",
        description: "기능과 디자인을 우선할 때 비교하기 좋은 상위 옵션입니다."
      });
    }
  }

  return products.map((product) => {
    const recommendation = recommendationById.get(product.id);
    if (!recommendation && !product.isRecommended) return product;
    return {
      ...product,
      isRecommended: true,
      recommendLabel: product.recommendLabel ?? recommendation?.label,
      recommendDescription: product.recommendDescription ?? recommendation?.description
    };
  });
}

export const REPLACEMENT_PRODUCTS: ReplacementProduct[] = withRecommendationMetadata([...TOILET_AS_REPLACEMENT_PRODUCTS, ...GENERATED_PRODUCTS]);

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

function replacementProductSearchText(product?: Pick<ReplacementProduct, "categoryName" | "model" | "note" | "sourceSheet"> | null) {
  return [product?.categoryName, product?.model, product?.note, product?.sourceSheet].filter(Boolean).join(" ");
}

export function getProductLaborPrice(serviceCode: string, product?: Pick<ReplacementProduct, "categoryName" | "model" | "note" | "sourceSheet"> | null) {
  const canonical = productCatalogServiceCode(serviceCode);
  if (canonical === "toilet_replace") return TOILET_REPLACE_LABOR_PRICE;
  if (canonical === "faucet_replace") {
    const text = replacementProductSearchText(product);
    if (text.includes("레인샤워")) return 100000;
    if (text.includes("샤워욕조") || text.includes("샤워수전") || text.includes("샤워 수전")) return 60000;
    if (text.includes("세면") || text.includes("주방")) return 40000;
    return FAUCET_REPLACE_LABOR_PRICE;
  }
  if (canonical === "bidet_install") return BIDET_INSTALL_LABOR_PRICE;
  if (canonical === "ventilator_replace") {
    const text = replacementProductSearchText(product);
    if (text.includes("복합") || text.includes("휴젠뜨") || text.includes("온풍") || text.includes("제습") || text.includes("헤어") || text.includes("바디") || text.includes("히터")) {
      return 80000;
    }
    return VENTILATOR_REPLACE_LABOR_PRICE;
  }
  if (canonical === "basin_replace") return BASIN_REPLACE_LABOR_PRICE;
  if (canonical === "sash_handle") return SASH_HANDLE_REPLACE_LABOR_PRICE;
  if (canonical === "door_handle") return DOOR_HANDLE_REPLACE_LABOR_PRICE;
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

function replacementProductNoteSegments(note: string | null | undefined) {
  return (note ?? "")
    .replace(/[★]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/[,.，、]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isReplacementProductSizeSegment(segment: string) {
  return /^사이즈\s*[:：]?\s*/.test(segment);
}

function normalizeReplacementProductSize(value: string) {
  return value
    .replace(/\[W\]/gi, "W")
    .replace(/\[D\]/gi, "D")
    .replace(/\[H\]/gi, "H")
    .replace(/\s*[xX]\s*/g, "×")
    .replace(/\s*×\s*/g, "×")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

export function replacementProductSizeLabel(product: Pick<ReplacementProduct, "note" | "size">) {
  const explicitSize = product.size?.trim();
  const noteSize = replacementProductNoteSegments(product.note)
    .find(isReplacementProductSizeSegment)
    ?.replace(/^사이즈\s*[:：]?\s*/, "")
    .trim();
  const size = normalizeReplacementProductSize(explicitSize || noteSize || "");
  if (!size) return "";
  return size.startsWith("사이즈") ? size : `사이즈 ${size}`;
}

export function replacementProductCompactSizeLabel(product: Pick<ReplacementProduct, "note" | "size">) {
  const fullSizeLabel = replacementProductSizeLabel(product);
  if (!fullSizeLabel) return "";

  const sizeValue = fullSizeLabel.replace(/^사이즈\s*/, "").trim();
  const slashParts = sizeValue.split("/").map((part) => part.trim()).filter(Boolean);
  if (slashParts.length >= 2) {
    const dimensionPart = slashParts.find((part) => /×/.test(part)) ?? slashParts[1];
    return `사이즈 ${slashParts[0]} / ${dimensionPart}`;
  }

  return fullSizeLabel;
}

export function replacementProductSnapshot(product: ReplacementProduct) {
  const sizeLabel = replacementProductSizeLabel(product);
  return {
    id: product.id,
    serviceCode: product.serviceCode,
    category: product.categoryName,
    brand: product.brand,
    model: product.model,
    sku: product.sku,
    ...(sizeLabel ? { size: sizeLabel } : {}),
    price: product.price,
    image: product.image
  };
}
