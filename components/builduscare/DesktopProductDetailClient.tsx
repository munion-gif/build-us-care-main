"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Package, Palette, Ruler, X } from "lucide-react";
import {
  colorChoiceLabel,
  colorVariantChoices,
  defaultColor,
  formatKRW,
  initialDetailProduct,
  isProductGroupSelected,
  normalizeSelectedColor,
  productColorText,
  productDisplayLabel,
  productGroupVariants,
  sashColorChoices,
  sashSizeChoices,
  sashSizeOf,
  selectionKey
} from "@/components/builduscare/product-helpers";
import { featureSpec, primarySpec, skuSpec } from "@/components/builduscare/product-detail-utils";
import type { ProductSelection } from "@/components/builduscare/product-types";
import type { BuilduscarePublicProduct } from "@/lib/builduscare-public-products";
import type { BuilduscareCategory } from "@/lib/builduscare-public-routes";

type StoredSelection = {
  id?: string;
  selectedColor?: string;
  qty?: number;
};

type StoredOrderPrefs = {
  selfDisposal?: boolean;
  itemLabel?: string;
};

type DesktopProductDetailClientProps = {
  category: BuilduscareCategory;
  product: BuilduscarePublicProduct;
  products: BuilduscarePublicProduct[];
};

const PRODUCT_SELECTIONS_STORAGE_KEY = "builduscare:productSelections";
const PRODUCT_ORDER_PREFS_STORAGE_KEY = "builduscare:productOrderPrefs";
const PRODUCT_SELECTIONS_COOKIE_KEY = "builduscare_productSelections";
const PRODUCT_ORDER_PREFS_COOKIE_KEY = "builduscare_productOrderPrefs";
const PRODUCT_STORAGE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function buildImageAlt(product: BuilduscarePublicProduct) {
  return [product.brand, product.displayModel].filter(Boolean).join(" ");
}

function selectedColorOf(product: BuilduscarePublicProduct) {
  const firstOption = product.colorOptions[0];
  if (firstOption) return normalizeSelectedColor(product, firstOption);
  const firstColor = String(product.color ?? "").split("/")[0]?.trim();
  return normalizeSelectedColor(product, firstColor);
}

function selectedColorFromState(product: BuilduscarePublicProduct, selections: ProductSelection[]) {
  return selections.find((item) => item.product.id === product.id)?.selectedColor;
}

function readCookieValue(key: string) {
  if (typeof document === "undefined") return null;
  const prefix = `${key}=`;
  const row = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  if (!row) return null;
  try {
    return decodeURIComponent(row.slice(prefix.length));
  } catch {
    return null;
  }
}

function writeCookieValue(key: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${PRODUCT_STORAGE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

function readStoredSelections() {
  if (typeof window === "undefined") return [];
  let raw = "";
  try {
    raw = window.localStorage.getItem(PRODUCT_SELECTIONS_STORAGE_KEY) ?? "";
  } catch {
    raw = "";
  }
  if (!raw) {
    try {
      raw = window.sessionStorage.getItem(PRODUCT_SELECTIONS_STORAGE_KEY) ?? "";
    } catch {
      raw = "";
    }
  }
  if (!raw) raw = readCookieValue(PRODUCT_SELECTIONS_COOKIE_KEY) ?? "";
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw) as StoredSelection[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function readStoredOrderPrefs(): StoredOrderPrefs {
  if (typeof window === "undefined") return {};
  let raw = "";
  try {
    raw = window.localStorage.getItem(PRODUCT_ORDER_PREFS_STORAGE_KEY) ?? "";
  } catch {
    raw = "";
  }
  if (!raw) {
    try {
      raw = window.sessionStorage.getItem(PRODUCT_ORDER_PREFS_STORAGE_KEY) ?? "";
    } catch {
      raw = "";
    }
  }
  if (!raw) raw = readCookieValue(PRODUCT_ORDER_PREFS_COOKIE_KEY) ?? "";
  if (!raw) return {};
  try {
    const prefs = JSON.parse(raw) as StoredOrderPrefs;
    return prefs && typeof prefs === "object" ? prefs : {};
  } catch {
    return {};
  }
}

function writeStoredSelections(rows: StoredSelection[], itemLabel: string) {
  if (typeof window === "undefined") return;
  const selectionsValue = JSON.stringify(rows);
  const previousPrefs = readStoredOrderPrefs();
  const orderPrefs = { ...previousPrefs, itemLabel };
  const prefsValue = JSON.stringify(orderPrefs);
  (
    window as Window & {
      __builduscareProductDraft?: {
        selections?: StoredSelection[] | null;
        orderPrefs?: StoredOrderPrefs | null;
      };
    }
  ).__builduscareProductDraft = {
    selections: rows,
    orderPrefs
  };
  window.localStorage.setItem(PRODUCT_SELECTIONS_STORAGE_KEY, selectionsValue);
  window.sessionStorage.setItem(PRODUCT_SELECTIONS_STORAGE_KEY, selectionsValue);
  window.localStorage.setItem(PRODUCT_ORDER_PREFS_STORAGE_KEY, prefsValue);
  window.sessionStorage.setItem(PRODUCT_ORDER_PREFS_STORAGE_KEY, prefsValue);
  writeCookieValue(PRODUCT_SELECTIONS_COOKIE_KEY, selectionsValue);
  writeCookieValue(PRODUCT_ORDER_PREFS_COOKIE_KEY, prefsValue);
}

function restoreSelections(rows: StoredSelection[], products: BuilduscarePublicProduct[]) {
  const restored: ProductSelection[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const product = products.find((item) => item.id === row.id);
    if (!product) continue;
    const selectedColor = normalizeSelectedColor(product, row.selectedColor);
    const key = selectionKey(product, selectedColor);
    if (seen.has(key)) continue;
    seen.add(key);
    restored.push({ product, selectedColor, qty: Math.max(1, Math.min(20, Number(row.qty || 1))) });
  }
  return restored;
}

export function DesktopProductDetailClient({ category, product, products }: DesktopProductDetailClientProps) {
  const [storedSelections, setStoredSelections] = useState<ProductSelection[]>([]);
  const initialProduct = useMemo(() => initialDetailProduct(product, products, storedSelections), [product, products, storedSelections]);
  const [activeProduct, setActiveProduct] = useState(initialProduct);
  const [selectedColor, setSelectedColor] = useState(selectedColorFromState(initialProduct, storedSelections) ?? selectedColorOf(initialProduct));

  useEffect(() => {
    setStoredSelections(restoreSelections(readStoredSelections(), products));
  }, [products]);

  useEffect(() => {
    setActiveProduct(initialProduct);
    setSelectedColor(selectedColorFromState(initialProduct, storedSelections) ?? selectedColorOf(initialProduct));
  }, [initialProduct, storedSelections]);

  const price = formatKRW(activeProduct.roundedPrice).replace(/원$/, "");
  const sizeChoices = sashSizeChoices(product, products);
  const showSizeChoices = sizeChoices.length > 1 || (sizeChoices.length === 1 && sizeChoices[0]?.size !== "기본");
  const sashColors = sashColorChoices(product, activeProduct, products);
  const colorVariants = colorVariantChoices(product, products);
  const generalColors = product.serviceCode === "sash_handle" || colorVariants.length > 0 || product.colorOptions.length <= 1 ? [] : product.colorOptions;
  const isVariantChoice = sizeChoices.length > 0 || colorVariants.length > 0;
  const normalizedSelectedColor = normalizeSelectedColor(activeProduct, selectedColor || defaultColor(activeProduct));
  const activeSelectionKey = selectionKey(activeProduct, normalizedSelectedColor);
  const mainSpec = primarySpec(activeProduct);
  const detailsSpec = featureSpec(activeProduct, mainSpec);
  const hasGeneralColorChoices = generalColors.length > 0;
  const selected = isVariantChoice
    ? storedSelections.some((item) => selectionKey(item.product, item.selectedColor) === activeSelectionKey)
    : hasGeneralColorChoices
      ? storedSelections.some((item) => selectionKey(item.product, item.selectedColor) === activeSelectionKey)
      : isProductGroupSelected(storedSelections, activeProduct, products);

  function chooseSashSize(choiceProduct: BuilduscarePublicProduct) {
    const choices = sashColorChoices(product, choiceProduct, products);
    const wantedColor = selectedColor && choices.some((choice) => choice.color === selectedColor)
      ? selectedColor
      : selectedColorOf(choiceProduct);
    const resolved = choices.find((choice) => choice.color === wantedColor)?.product ?? choiceProduct;
    setActiveProduct(resolved);
    setSelectedColor(wantedColor);
  }

  function chooseSashColor(color: string, choiceProduct: BuilduscarePublicProduct) {
    setActiveProduct(choiceProduct);
    setSelectedColor(normalizeSelectedColor(choiceProduct, color));
  }

  function chooseColorVariant(color: string, choiceProduct: BuilduscarePublicProduct) {
    setActiveProduct(choiceProduct);
    setSelectedColor(normalizeSelectedColor(choiceProduct, color));
  }

  function addToSelections() {
    const variants = productGroupVariants(product, products);
    const current = readStoredSelections();
    const withoutGroup = current.filter((row) => !variants.some((variant) => variant.id === row.id));
    const next = [...withoutGroup, { id: activeProduct.id, selectedColor: normalizedSelectedColor, qty: 1 }];
    writeStoredSelections(next, `${category.title} 교체`);
    setStoredSelections(restoreSelections(next, products));
  }

  return (
    <main className="bc-page detail-page-route">
      <div className="wrap detail-page-wrap">
        <div className="detail-page-head">
          <a className="detail-page-back" href={`/products/${category.slug}`}>제품 목록으로</a>
        </div>
        <article className="pm-card detail-route-card" aria-label="제품 상세">
          <a className="pm-close" href={`/products/${category.slug}`} aria-label="닫기">
            <X size={20} />
          </a>
          <div className="pm-body">
            <div className="pm-gallery">
              <div className="pm-hero imgph has-img">
                <img className="product-img" src={activeProduct.image ?? category.image} alt={buildImageAlt(activeProduct)} decoding="async" />
              </div>
            </div>
            <div className="pm-detail-info">
              <span className="pm-brand">{product.brand}</span>
              <h1 className="pm-title">{productDisplayLabel(product)}</h1>
              <div className="pm-row">
                <strong className="pm-price">{price}<small>원</small></strong>
                <button className={`pm-buy${selected ? " added" : ""}`} type="button" onClick={addToSelections}>
                  {selected ? "담김 ✓" : "담기"}
                </button>
              </div>

              {showSizeChoices && (
                <div className="size-choice-box">
                  <div className="size-choice-label">사이즈</div>
                  <div className="size-choice-options">
                    {sizeChoices.map((item) => {
                      const active = (sashSizeOf(activeProduct) || "기본") === item.size;
                      return (
                        <button
                          key={item.size}
                          className={`size-choice-btn${active ? " selected" : ""}`}
                          type="button"
                          onClick={() => chooseSashSize(item.product)}
                        >
                          <b>{item.size}</b>
                          <span>{formatKRW(item.product.roundedPrice)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {sashColors.length > 0 && (
                <div className="size-choice-box color-choice-box">
                  <div className="size-choice-label">색상</div>
                  <div className="size-choice-options">
                    {sashColors.map((item) => (
                      <button
                        key={item.color}
                        className={`size-choice-btn color-choice-btn${selectedColor === item.color ? " selected" : ""}`}
                        type="button"
                        onClick={() => chooseSashColor(item.color, item.product)}
                      >
                        <b>{item.color}</b>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {colorVariants.length > 0 && (
                <div className="size-choice-box color-choice-box">
                  <div className="size-choice-label">색상</div>
                  <div className="size-choice-options">
                    {colorVariants.map((item) => (
                      <button
                        key={item.color}
                        className={`size-choice-btn color-choice-btn${activeProduct.id === item.product.id ? " selected" : ""}`}
                        type="button"
                        onClick={() => chooseColorVariant(item.color, item.product)}
                      >
                        <b>{item.color}</b>
                        <span>{formatKRW(item.product.roundedPrice)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {generalColors.length > 0 && (
                <div className="size-choice-box color-choice-box">
                  <div className="size-choice-label">색상</div>
                  <div className="size-choice-options">
                    {generalColors.map((item) => {
                      const label = colorChoiceLabel(item);
                      const active = selectedColor === item || selectedColor === label;
                      return (
                        <button
                          key={item}
                          className={`size-choice-btn color-choice-btn${active ? " selected" : ""}`}
                          type="button"
                          onClick={() => setSelectedColor(normalizeSelectedColor(activeProduct, label || item))}
                        >
                          <b>{label}</b>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pm-specs">
                <div className="pm-spec">
                  <span className="pm-ic"><Ruler size={20} /></span>
                  <p>{mainSpec}</p>
                </div>
                <div className="pm-spec">
                  <span className="pm-ic"><Package size={20} /></span>
                  <p>품번 · {skuSpec(activeProduct)}</p>
                </div>
                <div className="pm-spec">
                  <span className="pm-ic"><Palette size={20} /></span>
                  <p>색상 · {selectedColor || productColorText(activeProduct)}</p>
                </div>
                <div className="pm-spec">
                  <span className="pm-ic"><Info size={20} /></span>
                  <p>{detailsSpec}</p>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
