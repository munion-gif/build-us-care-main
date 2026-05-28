import rawToiletProducts from "./toilet-products.generated.json";

export type ToiletProductCategoryId = "two-piece" | "one-piece" | "smart-bidet";

export type ToiletProduct = {
  id: string;
  categoryId: ToiletProductCategoryId;
  categoryName: string;
  categorySummary: string;
  decisionHint: string;
  brand: string;
  model: string;
  sku: string;
  price: number | null;
  note: string;
  popular: boolean;
  isRecommended?: boolean;
  recommendLabel?: string;
  recommendDescription?: string;
  image: string | null;
  sourceSheet: string;
  sourceRow: number;
};

export type ToiletProductGroup = {
  id: ToiletProductCategoryId;
  name: string;
  summary: string;
  decisionHint: string;
  minPrice: number | null;
  count: number;
  popularCount: number;
  products: ToiletProduct[];
};

const CATEGORY_ORDER: ToiletProductCategoryId[] = ["two-piece", "one-piece", "smart-bidet"];

export const TOILET_PRODUCTS = rawToiletProducts as ToiletProduct[];

const TOILET_PRODUCT_PRICES = TOILET_PRODUCTS
  .map((product) => product.price)
  .filter((price): price is number => typeof price === "number");

export const TOILET_PRODUCT_MIN_PRICE = TOILET_PRODUCT_PRICES.length > 0 ? Math.min(...TOILET_PRODUCT_PRICES) : 0;

export const TOILET_PRODUCT_SOURCE_NOTE = "엑셀 제품 리스트 기준 제품가입니다. 실제 주문 금액은 시공비, 폐기, 현장 부속, 재고에 따라 확정됩니다.";

export const TOILET_PRODUCT_GROUPS: ToiletProductGroup[] = CATEGORY_ORDER.map((categoryId) => {
  const products = TOILET_PRODUCTS.filter((product) => product.categoryId === categoryId);
  const first = products[0];
  const prices = products.map((product) => product.price).filter((price): price is number => typeof price === "number");

  return {
    id: categoryId,
    name: first?.categoryName ?? categoryId,
    summary: first?.categorySummary ?? "",
    decisionHint: first?.decisionHint ?? "",
    minPrice: prices.length > 0 ? Math.min(...prices) : null,
    count: products.length,
    popularCount: products.filter((product) => product.popular).length,
    products
  };
});
