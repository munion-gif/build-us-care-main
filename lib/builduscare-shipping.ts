import { productCatalogServiceCode, type ReplacementProductServiceCode } from "@/lib/replacement-products";

export const HEAVY_PRODUCT_SHIPPING_FEE = 10000;
export const SMALL_HARDWARE_SHIPPING_FEE = 4000;
export const MEDIUM_PRODUCT_SHIPPING_FEE = 6000;
export const SILICONE_SHIPPING_FEE = 3000;
export const BATH_ACCESSORY_SET_SHIPPING_FEE = 6000;
export const BATH_ACCESSORY_ITEM_SHIPPING_FEE = 4000;

export type ShippingFeeApplication = "per_unit" | "flat";

const HEAVY_PRODUCT_SERVICE_CODES = new Set<ReplacementProductServiceCode>(["toilet_replace", "basin_replace"]);
const SMALL_HARDWARE_SERVICE_CODES = new Set<ReplacementProductServiceCode>(["faucet_replace", "door_handle", "sash_handle"]);
const MEDIUM_PRODUCT_SERVICE_CODES = new Set<ReplacementProductServiceCode>(["bidet_install", "ventilator_replace"]);

type ShippingProductHint = {
  categoryName?: string | null;
  label?: string | null;
  model?: string | null;
  displayModel?: string | null;
  displayName?: string | null;
  note?: string | null;
  sourceSheet?: string | null;
};

function productSearchText(product?: ShippingProductHint | null) {
  return [product?.categoryName, product?.label, product?.model, product?.displayModel, product?.displayName, product?.note, product?.sourceSheet].filter(Boolean).join(" ");
}

function isBathAccessorySet(product?: ShippingProductHint | null) {
  const text = productSearchText(product);
  return text.includes("세트") || text.includes("풀세트");
}

export function productShippingFee(serviceCode?: string | null, product?: ShippingProductHint | null) {
  const canonical = serviceCode ? productCatalogServiceCode(serviceCode) : null;
  if (!canonical) return 0;
  if (HEAVY_PRODUCT_SERVICE_CODES.has(canonical)) return HEAVY_PRODUCT_SHIPPING_FEE;
  if (SMALL_HARDWARE_SERVICE_CODES.has(canonical)) return SMALL_HARDWARE_SHIPPING_FEE;
  if (MEDIUM_PRODUCT_SERVICE_CODES.has(canonical)) return MEDIUM_PRODUCT_SHIPPING_FEE;
  if (canonical === "silicone_repair") return SILICONE_SHIPPING_FEE;
  if (canonical === "bath_accessory") {
    return isBathAccessorySet(product) ? BATH_ACCESSORY_SET_SHIPPING_FEE : BATH_ACCESSORY_ITEM_SHIPPING_FEE;
  }
  return 0;
}

export function productShippingFeeApplication(serviceCode?: string | null): ShippingFeeApplication {
  const canonical = serviceCode ? productCatalogServiceCode(serviceCode) : null;
  if (canonical && SMALL_HARDWARE_SERVICE_CODES.has(canonical)) return "flat";
  return "per_unit";
}

export function productShippingLineAmount(serviceCode?: string | null, qty = 1, product?: ShippingProductHint | null) {
  const fee = productShippingFee(serviceCode, product);
  const application = productShippingFeeApplication(serviceCode);
  if (application === "flat") return fee;
  return fee * Math.max(1, Number(qty || 1));
}

export function productShippingEntryAmounts<T>(
  entries: T[],
  selectors: {
    serviceCode: (entry: T) => string | null | undefined;
    qty: (entry: T) => number | null | undefined;
    product?: (entry: T) => ShippingProductHint | null | undefined;
  }
) {
  const chargedFlatServices = new Set<string>();
  return entries.map((entry) => {
    const serviceCode = selectors.serviceCode(entry);
    const canonical = serviceCode ? productCatalogServiceCode(serviceCode) : null;
    if (canonical && productShippingFeeApplication(canonical) === "flat") {
      if (chargedFlatServices.has(canonical)) return 0;
      chargedFlatServices.add(canonical);
    }
    return productShippingLineAmount(canonical, Number(selectors.qty(entry) ?? 1), selectors.product?.(entry));
  });
}

export function productShippingEntriesTotal<T>(
  entries: T[],
  selectors: {
    serviceCode: (entry: T) => string | null | undefined;
    qty: (entry: T) => number | null | undefined;
    product?: (entry: T) => ShippingProductHint | null | undefined;
  }
) {
  return productShippingEntryAmounts(entries, selectors).reduce((sum, amount) => sum + amount, 0);
}

export function productShippingPolicyLabel(serviceCode?: string | null, product?: ShippingProductHint | null) {
  const canonical = serviceCode ? productCatalogServiceCode(serviceCode) : null;
  if (!canonical) return "배송비 없음";
  if (HEAVY_PRODUCT_SERVICE_CODES.has(canonical)) return "양변기/세면대 개당 배송비";
  if (SMALL_HARDWARE_SERVICE_CODES.has(canonical)) return "수전/도어핸들/샷시손잡이 묶음 배송비";
  if (MEDIUM_PRODUCT_SERVICE_CODES.has(canonical)) return "비데/환풍기 배송비";
  if (canonical === "silicone_repair") return "실리콘 배송비";
  if (canonical === "bath_accessory") {
    return isBathAccessorySet(product) ? "욕실 악세서리 세트 배송비" : "욕실 악세서리 단품 배송비";
  }
  return "배송비 없음";
}

export function quoteItemsShippingAmount(items?: unknown) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    if (!item || typeof item !== "object") return sum;
    const record = item as Record<string, any>;
    const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata as Record<string, any> : {};
    const metadataTotal = Number(metadata.shipping_fee_total ?? metadata.shipping_fee_amount ?? 0);
    if (Number.isFinite(metadataTotal) && metadataTotal > 0) return sum + metadataTotal;
    const optionTotal = Number(record.option_total ?? 0);
    return sum + (Number.isFinite(optionTotal) && optionTotal > 0 ? optionTotal : 0);
  }, 0);
}
