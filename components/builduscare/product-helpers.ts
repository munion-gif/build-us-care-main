import type { ProductSelection } from "@/components/builduscare/product-types";
import type { BuilduscarePublicProduct } from "@/lib/builduscare-public-products";
import { PRODUCT_DISPOSAL_FEE, productDisposalFee } from "@/lib/builduscare-disposal";
import { productShippingEntriesTotal } from "@/lib/builduscare-shipping";

export const PRODUCT_PAGE_SIZE = 15;
export { PRODUCT_DISPOSAL_FEE, productDisposalFee };
const SASH_SIZE_ORDER = ["소", "중", "대", "그립"];
const COLOR_VARIANT_SERVICE_CODES = new Set(["ventilator_replace"]);
const COLOR_VARIANT_ORDER = ["실버", "화이트", "크롬", "니켈", "블랙", "그레이", "블루", "핑크", "엘로우"];

export function formatKRW(value: number | null | undefined) {
  return `${Number(value ?? 0).toLocaleString("ko-KR")}원`;
}

export function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko-KR"));
}

export function colorChoiceLabel(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/^\s*(색상|컬러)\s*[·:.-]?\s*/u, "")
    .trim();
}

export function usefulColor(value: string | null | undefined) {
  const color = colorChoiceLabel(value);
  return Boolean(color && color !== "-" && color !== "기본");
}

export function defaultColor(product: BuilduscarePublicProduct) {
  const option = product.colorOptions[0] ?? String(product.color ?? "").split("/")[0] ?? "";
  const color = colorChoiceLabel(option);
  return usefulColor(color) ? color : "";
}

export function normalizeSelectedColor(product: BuilduscarePublicProduct, value: string | null | undefined) {
  const color = colorChoiceLabel(value);
  return usefulColor(color) ? color : defaultColor(product);
}

export function productColorText(product: BuilduscarePublicProduct) {
  return product.colorOptions.length > 0 ? product.colorOptions.join(" / ") : product.color || "기본";
}

export function selectionKey(product: BuilduscarePublicProduct, selectedColor: string) {
  return `${product.id}::${selectedColor || "default"}`;
}

export function isProductSelected(selections: ProductSelection[], product: BuilduscarePublicProduct) {
  return selections.some((item) => item.product.id === product.id);
}

export function sashSizeOf(product?: BuilduscarePublicProduct | null) {
  const explicit = String(product?.size ?? "").split("/")[0]?.trim() ?? "";
  if (SASH_SIZE_ORDER.includes(explicit)) return explicit;
  const text = [product?.model, product?.displayModel, product?.displayName, product?.note].filter(Boolean).join(" ");
  const match = text.match(/(?:사이즈\s*)?(소|중|대|그립)\b/u);
  return match?.[1] ?? "";
}

export function sashBaseOf(product?: BuilduscarePublicProduct | null) {
  let text = String(product?.model || product?.displayModel || product?.displayName || "")
    .replace(/\s(소|중|대|그립)$/u, "")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = text.split(" ").filter(Boolean);
  if (tokens.length >= 2) {
    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let size = Math.floor(tokens.length / 2); size >= 1; size -= 1) {
        for (let start = 0; start + size * 2 <= tokens.length; start += 1) {
          let same = true;
          for (let index = 0; index < size; index += 1) {
            if (tokens[start + index] !== tokens[start + size + index]) {
              same = false;
              break;
            }
          }
          if (same) {
            tokens.splice(start + size, size);
            changed = true;
            break outer;
          }
        }
      }
    }
    text = tokens.join(" ") || text;
  }
  return text;
}

function colorOrder(color: string) {
  const index = COLOR_VARIANT_ORDER.indexOf(color);
  return index < 0 ? 99 : index;
}

function colorPartsOf(product: BuilduscarePublicProduct) {
  const values = product.colorOptions.length ? product.colorOptions : String(product.color ?? "").split("/");
  return values.map(colorChoiceLabel).filter(usefulColor);
}

export function productGroupKey(product: BuilduscarePublicProduct) {
  if (product.serviceCode === "sash_handle") return `${product.serviceCode}|${product.brand}|${sashBaseOf(product) || product.id}`;
  if (product.serviceCode === "bath_accessory") return `${product.serviceCode}|${product.brand}|${product.sku || product.id}|${product.color || ""}`;
  return [
    product.serviceCode,
    product.categoryName,
    product.brand,
    product.model || product.displayModel || product.sku || product.id
  ].join("|");
}

export function productGroupVariants(product: BuilduscarePublicProduct, products: BuilduscarePublicProduct[]) {
  const key = productGroupKey(product);
  const variants = products.filter((item) => productGroupKey(item) === key);
  if (product.serviceCode === "sash_handle") return variants;
  const colors = new Set(variants.map((item) => colorChoiceLabel(item.color)).filter(usefulColor));
  if (COLOR_VARIANT_SERVICE_CODES.has(product.serviceCode) && colors.size > 1) return variants;
  const prices = new Set(variants.map((item) => item.roundedPrice));
  return prices.size > 1 ? variants : [product];
}

export function hasProductChoiceVariants(product: BuilduscarePublicProduct, products: BuilduscarePublicProduct[]) {
  if (product.serviceCode === "sash_handle") return sashSizeChoices(product, products).length > 0;
  return productGroupVariants(product, products).length > 1;
}

export function isProductGroupSelected(selections: ProductSelection[], product: BuilduscarePublicProduct, products: BuilduscarePublicProduct[]) {
  const variants = productGroupVariants(product, products);
  return selections.some((selection) => variants.some((variant) => variant.id === selection.product.id));
}

export function representativeProductList(list: BuilduscarePublicProduct[], source = list) {
  const groups = new Map<string, BuilduscarePublicProduct[]>();
  for (const product of source) {
    const key = productGroupKey(product);
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }

  const seen = new Set<string>();
  const output: BuilduscarePublicProduct[] = [];
  for (const product of list) {
    const key = productGroupKey(product);
    const group = groups.get(key) ?? [product];
    const shouldGroup =
      product.serviceCode === "sash_handle" ||
      (COLOR_VARIANT_SERVICE_CODES.has(product.serviceCode) && new Set(group.map((item) => colorChoiceLabel(item.color)).filter(usefulColor)).size > 1) ||
      new Set(group.map((item) => item.roundedPrice)).size > 1;

    if (!shouldGroup) {
      output.push(product);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(group.reduce((best, item) => item.roundedPrice < best.roundedPrice ? item : best, group[0]));
  }
  return output;
}

export function sashSizeChoices(product: BuilduscarePublicProduct, products: BuilduscarePublicProduct[]) {
  if (product.serviceCode !== "sash_handle") return [];
  const bySize = new Map<string, BuilduscarePublicProduct>();
  for (const variant of productGroupVariants(product, products)) {
    const size = sashSizeOf(variant) || "기본";
    const previous = bySize.get(size);
    if (!previous || variant.roundedPrice < previous.roundedPrice) bySize.set(size, variant);
  }
  return [...bySize.entries()]
    .sort(([a, av], [b, bv]) => {
      const ai = SASH_SIZE_ORDER.indexOf(a);
      const bi = SASH_SIZE_ORDER.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || av.roundedPrice - bv.roundedPrice;
    })
    .map(([size, choiceProduct]) => ({ size, product: choiceProduct }));
}

export function sashColorChoices(sourceProduct: BuilduscarePublicProduct, selectedProduct: BuilduscarePublicProduct, products: BuilduscarePublicProduct[]) {
  if (sourceProduct.serviceCode !== "sash_handle") return [];
  const selectedSize = sashSizeOf(selectedProduct) || "기본";
  const byColor = new Map<string, BuilduscarePublicProduct>();
  for (const variant of productGroupVariants(sourceProduct, products)) {
    if ((sashSizeOf(variant) || "기본") !== selectedSize) continue;
    for (const color of colorPartsOf(variant)) {
      const previous = byColor.get(color);
      if (!previous || variant.roundedPrice < previous.roundedPrice) byColor.set(color, variant);
    }
  }
  if (byColor.size < 2) return [];
  return [...byColor.entries()]
    .sort(([a, av], [b, bv]) => colorOrder(a) - colorOrder(b) || av.roundedPrice - bv.roundedPrice || a.localeCompare(b, "ko-KR"))
    .map(([color, choiceProduct]) => ({ color, product: choiceProduct }));
}

export function colorVariantChoices(product: BuilduscarePublicProduct, products: BuilduscarePublicProduct[]) {
  if (!COLOR_VARIANT_SERVICE_CODES.has(product.serviceCode)) return [];
  const byColor = new Map<string, BuilduscarePublicProduct>();
  for (const variant of productGroupVariants(product, products)) {
    const color = colorChoiceLabel(variant.color);
    if (!usefulColor(color)) continue;
    const previous = byColor.get(color);
    if (!previous || variant.roundedPrice < previous.roundedPrice) byColor.set(color, variant);
  }
  if (byColor.size < 2) return [];
  return [...byColor.entries()]
    .sort(([a, av], [b, bv]) => colorOrder(a) - colorOrder(b) || av.roundedPrice - bv.roundedPrice || a.localeCompare(b, "ko-KR"))
    .map(([color, choiceProduct]) => ({ color, product: choiceProduct }));
}

export function initialDetailProduct(product: BuilduscarePublicProduct, products: BuilduscarePublicProduct[], selections: ProductSelection[]) {
  const variants = productGroupVariants(product, products);
  return variants.find((variant) => selections.some((selection) => selection.product.id === variant.id)) ?? variants.find((variant) => variant.id === product.id) ?? variants[0] ?? product;
}

export function buildImageAlt(product: BuilduscarePublicProduct) {
  return [product.brand, product.displayModel].filter(Boolean).join(" ");
}

export function productDisplayLabel(product: BuilduscarePublicProduct) {
  if (product.serviceCode === "sash_handle") return sashBaseOf(product) || product.displayModel;
  return product.displayModel;
}

export function shouldDisplaySelectedColor(product: BuilduscarePublicProduct, selectedColor: string | null | undefined, products: BuilduscarePublicProduct[] = []) {
  const color = colorChoiceLabel(selectedColor);
  if (!usefulColor(color)) return false;
  if (product.serviceCode === "sash_handle") return true;
  if (!COLOR_VARIANT_SERVICE_CODES.has(product.serviceCode)) return false;
  if (products.length > 0) return colorVariantChoices(product, products).length > 0;
  return colorPartsOf(product).length > 1 || product.colorOptions.length > 1;
}

export function selectionDisplayLabel(product: BuilduscarePublicProduct, selectedColor: string | null | undefined, products: BuilduscarePublicProduct[] = []) {
  const label = productDisplayLabel(product);
  if (!shouldDisplaySelectedColor(product, selectedColor, products)) return label;
  return `${label} · ${colorChoiceLabel(selectedColor)}`;
}

function compareCatalogModel(a: BuilduscarePublicProduct, b: BuilduscarePublicProduct) {
  const aLabel = a.model || a.displayModel || a.sku || a.id;
  const bLabel = b.model || b.displayModel || b.sku || b.id;
  return aLabel.localeCompare(bLabel, "ko-KR", { numeric: true, sensitivity: "base" });
}

export function sortProducts(products: BuilduscarePublicProduct[], sort: string) {
  const copy = [...products];
  if (sort === "low") return copy.sort((a, b) => a.roundedPrice - b.roundedPrice || compareCatalogModel(a, b));
  if (sort === "high") return copy.sort((a, b) => b.roundedPrice - a.roundedPrice || compareCatalogModel(a, b));
  if (sort === "popular") {
    return copy.sort((a, b) => Number(b.popular) - Number(a.popular) || a.roundedPrice - b.roundedPrice || compareCatalogModel(a, b));
  }
  return copy.sort((a, b) => Number(b.isRecommended) - Number(a.isRecommended) || Number(b.popular) - Number(a.popular) || compareCatalogModel(a, b));
}

export function productTotals(selections: ProductSelection[], selfDisposal = false) {
  const units = selections.reduce((sum, item) => sum + item.qty, 0);
  const productAmount = selections.reduce((sum, item) => sum + item.product.roundedPrice * item.qty, 0);
  const laborAmount = selections.reduce((sum, item) => sum + item.product.laborPrice * item.qty, 0);
  const shippingAmount = productShippingEntriesTotal(selections, {
    serviceCode: (item) => item.product.serviceCode,
    qty: (item) => item.qty,
    product: (item) => item.product
  });
  const disposalAmount = selfDisposal ? 0 : selections.reduce((sum, item) => sum + productDisposalFee(item.product.serviceCode) * item.qty, 0);
  return {
    units,
    productAmount,
    laborAmount,
    shippingAmount,
    disposalAmount,
    totalAmount: productAmount + laborAmount + shippingAmount + disposalAmount
  };
}
