import { quoteVatIncludedAmount } from "@/lib/quote-totals";
import {
  getProductLaborPrice,
  getReplacementProductCatalog,
  replacementProductCompactSizeLabel,
  replacementProductDisplayModel,
  replacementProductDisplayName,
  replacementProductSizeLabel,
  type ReplacementProduct,
  type ReplacementProductServiceCode
} from "@/lib/replacement-products";

export type BuilduscarePublicProduct = ReplacementProduct & {
  displayName: string;
  displayModel: string;
  compactSizeLabel: string;
  sizeLabel: string;
  roundedPrice: number;
  laborPrice: number;
  colorOptions: string[];
  sizeOptions: string[];
  featureText: string;
};

function roundedPrice(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  return quoteVatIncludedAmount(amount);
}

function splitSlashOptions(value?: string | null) {
  return String(value ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "-");
}

function firstSizeToken(value?: string | null) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.split("/")[0]?.trim() ?? "";
}

function noteFeatureText(product: ReplacementProduct) {
  const note = String(product.note ?? "")
    .replace(/(?:^|[\s,])포장:\s*1BOX\/EA:\s*40EA\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const metaStart = note.search(/(?:^|[\s,])(?:분류|섹션|가격구분|확인|비고|제조사단가)\s*:/u);
  const feature = metaStart >= 0 ? note.slice(metaStart).replace(/^[\s,]+/u, "") : note;
  if (metaStart < 0) {
    const featureParts = feature
      .split(/\s*,\s*/u)
      .map((part) => part.trim())
      .filter((part) => part && !/^사이즈\s*[:：]?\s*/u.test(part))
      .filter((part) => !/^색상\s+/u.test(part));
    return featureParts.join("\n");
  }
  const parts = feature
    .replace(/\s*,\s*(?=(?:분류|섹션|가격구분|확인|비고|제조사단가)\s*:)/gu, "\n")
    .split(/\n|(?=(?:분류|섹션|가격구분|확인|비고|제조사단가)\s*:)/gu)
    .map((part) => part.trim().replace(/\s+(?=(?:분류|섹션|가격구분|확인|비고|제조사단가)\s*:)/gu, "\n"))
    .flatMap((part) => part.split("\n"))
    .map((part) => part.trim())
    .filter((part) => !/^(?:비고|제조사단가)\s*:/u.test(part))
    .filter(Boolean);
  return parts.length > 1 ? parts.join("\n") : feature;
}

export function toBuilduscarePublicProduct(product: ReplacementProduct): BuilduscarePublicProduct {
  const colorOptions = splitSlashOptions(product.color);
  const sizeOption = firstSizeToken(product.size);
  return {
    ...product,
    displayName: replacementProductDisplayName(product),
    displayModel: replacementProductDisplayModel(product),
    compactSizeLabel: replacementProductCompactSizeLabel(product),
    sizeLabel: replacementProductSizeLabel(product),
    roundedPrice: roundedPrice(product.price),
    laborPrice: quoteVatIncludedAmount(getProductLaborPrice(product.serviceCode, product)),
    colorOptions,
    sizeOptions: sizeOption ? [sizeOption] : [],
    featureText: noteFeatureText(product)
  };
}

export function getBuilduscarePublicCatalog(serviceCode: ReplacementProductServiceCode) {
  const catalog = getReplacementProductCatalog(serviceCode);
  if (!catalog) return null;
  const products = catalog.products.map(toBuilduscarePublicProduct);
  return {
    ...catalog,
    minPrice: products.reduce((min, product) => {
      if (!product.roundedPrice) return min;
      return min === 0 ? product.roundedPrice : Math.min(min, product.roundedPrice);
    }, 0),
    products,
    groups: catalog.groups.map((group) => ({
      ...group,
      products: group.products.map(toBuilduscarePublicProduct)
    }))
  };
}
