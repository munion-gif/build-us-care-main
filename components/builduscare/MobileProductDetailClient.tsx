"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, Heart, Info, Menu, MessageCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildImageAlt,
  colorChoiceLabel,
  colorVariantChoices,
  defaultColor,
  formatKRW,
  initialDetailProduct,
  normalizeSelectedColor,
  productColorText,
  productDisplayLabel,
  productGroupVariants,
  sashColorChoices,
  sashSizeChoices,
  sashSizeOf,
  selectionKey,
  usefulColor
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

type MobileProductDetailClientProps = {
  category: BuilduscareCategory;
  product: BuilduscarePublicProduct;
  products: BuilduscarePublicProduct[];
};

const PRODUCT_SELECTIONS_STORAGE_KEY = "builduscare:productSelections";
const PRODUCT_ORDER_PREFS_STORAGE_KEY = "builduscare:productOrderPrefs";
const PRODUCT_SELECTIONS_COOKIE_KEY = "builduscare_productSelections";
const PRODUCT_ORDER_PREFS_COOKIE_KEY = "builduscare_productOrderPrefs";
const PRODUCT_STORAGE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function readStoredSelections() {
  if (typeof window === "undefined") return [];
  const cookiePrefix = `${PRODUCT_SELECTIONS_COOKIE_KEY}=`;
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
  if (!raw) {
    const row = document.cookie.split("; ").find((item) => item.startsWith(cookiePrefix));
    if (row) {
      try {
        raw = decodeURIComponent(row.slice(cookiePrefix.length));
      } catch {
        raw = "";
      }
    }
  }
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
  const cookiePrefix = `${PRODUCT_ORDER_PREFS_COOKIE_KEY}=`;
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
  if (!raw) {
    const row = document.cookie.split("; ").find((item) => item.startsWith(cookiePrefix));
    if (row) {
      try {
        raw = decodeURIComponent(row.slice(cookiePrefix.length));
      } catch {
        raw = "";
      }
    }
  }
  if (!raw) return {};
  try {
    const prefs = JSON.parse(raw) as StoredOrderPrefs;
    return prefs && typeof prefs === "object" ? prefs : {};
  } catch {
    return {};
  }
}

function writeCookieValue(key: string, value: string) {
  document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${PRODUCT_STORAGE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

function writeStoredSelections(rows: StoredSelection[], itemLabel: string) {
  const selectionsValue = JSON.stringify(rows);
  const previousPrefs = readStoredOrderPrefs();
  const orderPrefs = { ...previousPrefs, itemLabel };
  const prefsValue = JSON.stringify(orderPrefs);
  (window as Window & {
    __builduscareProductDraft?: {
      selections?: StoredSelection[] | null;
      orderPrefs?: StoredOrderPrefs | null;
    };
  }).__builduscareProductDraft = {
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

function selectedColorOf(product: BuilduscarePublicProduct) {
  const firstOption = product.colorOptions[0];
  if (firstOption) return normalizeSelectedColor(product, firstOption);
  const firstColor = String(product.color ?? "").split("/")[0]?.trim();
  return normalizeSelectedColor(product, firstColor);
}

function selectedColorFromState(product: BuilduscarePublicProduct, selections: ProductSelection[]) {
  return selections.find((item) => item.product.id === product.id)?.selectedColor;
}

function displayColor(value: string) {
  const color = colorChoiceLabel(value);
  return usefulColor(color) ? color : "기본";
}

function photoCheckHref(itemLabel: string) {
  return `/photo-check?item=${encodeURIComponent(itemLabel)}`;
}

function infoKind(product: BuilduscarePublicProduct, category: BuilduscareCategory) {
  if (product.categoryName) {
    if (category.serviceCode === "basin_replace") return product.categoryName.replace(/\s*세면기$/u, "");
    if (category.serviceCode === "faucet_replace") return product.categoryName.replace(/\s*수전$/u, "수전");
    return product.categoryName;
  }
  return category.title;
}

export function MobileProductDetailClient({ category, product, products }: MobileProductDetailClientProps) {
  const router = useRouter();
  const [storedSelections, setStoredSelections] = useState<ProductSelection[]>([]);
  const initialProduct = useMemo(() => initialDetailProduct(product, products, storedSelections), [product, products, storedSelections]);
  const [activeProduct, setActiveProduct] = useState(initialProduct);
  const [selectedColor, setSelectedColor] = useState(selectedColorFromState(initialProduct, storedSelections) ?? selectedColorOf(initialProduct));
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setStoredSelections(restoreSelections(readStoredSelections(), products));
  }, [products]);

  useEffect(() => {
    setActiveProduct(initialProduct);
    setSelectedColor(selectedColorFromState(initialProduct, storedSelections) ?? selectedColorOf(initialProduct));
  }, [initialProduct, storedSelections]);

  const mainSpec = primarySpec(activeProduct);
  const detailSpec = featureSpec(activeProduct, mainSpec);
  const catalogSpec = `${infoKind(activeProduct, category)} 카탈로그 기준`;
  const noteSpec = [mainSpec, detailSpec]
    .filter(Boolean)
    .flatMap((item) => item.split(/\n+/u).map((line) => line.trim()).filter(Boolean))
    .join(", ");
  const normalizedColor = normalizeSelectedColor(activeProduct, selectedColor);
  const sizeChoices = sashSizeChoices(product, products);
  const showSizeChoices = sizeChoices.length > 1 || (sizeChoices.length === 1 && sizeChoices[0]?.size !== "기본");
  const sashColors = sashColorChoices(product, activeProduct, products);
  const colorVariants = colorVariantChoices(product, products);
  const generalColors = product.serviceCode === "sash_handle" || colorVariants.length > 0
    ? []
    : product.colorOptions.map(colorChoiceLabel).filter(usefulColor);
  const fallbackColor = displayColor(productColorText(activeProduct));

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

  function addAndReturn() {
    const variants = productGroupVariants(product, products);
    const current = readStoredSelections();
    const withoutGroup = current.filter((row) => !variants.some((variant) => variant.id === row.id));
    const next = [...withoutGroup, { id: activeProduct.id, selectedColor: normalizedColor, qty: 1 }];
    writeStoredSelections(next, `${category.title} 교체`);
    router.push(`/products/${category.slug}`);
  }

  return (
    <main className="bc-page mobile-product-detail-route">
      <header className="mpd-appbar">
        <Link className="mpd-icon" href={`/products/${category.slug}`} aria-label="뒤로가기">
          <ChevronLeft aria-hidden="true" />
        </Link>
        <strong>제품 상세</strong>
        <div className="mpd-actions">
          <button className="mpd-icon" type="button" aria-label="관심 제품">
            <Heart aria-hidden="true" />
          </button>
          <button className="mpd-icon" type="button" aria-label="메뉴 열기" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
            <Menu aria-hidden="true" />
          </button>
        </div>
      </header>
      {menuOpen && (
        <nav className="mpd-menu" aria-label="모바일 메뉴">
          <Link className="mpd-menu-link" href="/service"><span>서비스 소개</span><ChevronRight aria-hidden="true" /></Link>
          <Link className="mpd-menu-link" href={photoCheckHref(category.itemLabel)}><span>사진으로 확인하기</span><ChevronRight aria-hidden="true" /></Link>
          <Link className="mpd-menu-link" href="/products"><span>바꿀 수 있는 제품 보기</span><ChevronRight aria-hidden="true" /></Link>
          <Link className="mpd-menu-link" href="/order-lookup"><span>내 주문 · 진행현황</span><ChevronRight aria-hidden="true" /></Link>
          <Link className="mpd-menu-link" href="/as-request"><span>A/S 접수</span><ChevronRight aria-hidden="true" /></Link>
        </nav>
      )}

      <section className="mpd-media">
        <div className="mpd-image">
          <img src={activeProduct.image ?? category.image} alt={buildImageAlt(activeProduct)} />
        </div>
        <div className="mpd-caption">제품 대표 이미지</div>
      </section>

      <section className="mpd-detail">
        <div className="mpd-brand">{activeProduct.brand}</div>
        <h1>{productDisplayLabel(product)}</h1>
        <div className="mpd-price">
          <strong>{formatKRW(activeProduct.roundedPrice)}</strong>
          <span>제품가</span>
        </div>

        {showSizeChoices && (
          <div className="mpd-choice">
            <div className="mpd-choice-title">사이즈</div>
            <div className="mpd-choice-row">
              {sizeChoices.map((item) => {
                const active = (sashSizeOf(activeProduct) || "기본") === item.size;
                return (
                  <button key={item.size} className={`mpd-choice-btn${active ? " selected" : ""}`} type="button" onClick={() => chooseSashSize(item.product)}>
                    {item.size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(sashColors.length > 0 || colorVariants.length > 0 || generalColors.length > 0 || fallbackColor) && (
          <div className="mpd-choice">
            <div className="mpd-choice-title">색상</div>
            <div className="mpd-choice-row">
              {sashColors.map((item) => (
                <button key={item.color} className={`mpd-choice-btn${selectedColor === item.color ? " selected" : ""}`} type="button" onClick={() => chooseSashColor(item.color, item.product)}>
                  {item.color}
                </button>
              ))}
              {colorVariants.map((item) => (
                <button key={item.color} className={`mpd-choice-btn${activeProduct.id === item.product.id ? " selected" : ""}`} type="button" onClick={() => chooseColorVariant(item.color, item.product)}>
                  {item.color}
                </button>
              ))}
              {generalColors.map((color) => (
                <button key={color} className={`mpd-choice-btn${selectedColor === color ? " selected" : ""}`} type="button" onClick={() => setSelectedColor(normalizeSelectedColor(activeProduct, color))}>
                  {color}
                </button>
              ))}
              {sashColors.length === 0 && colorVariants.length === 0 && generalColors.length === 0 && (
                <button className="mpd-choice-btn selected" type="button">{fallbackColor}</button>
              )}
            </div>
          </div>
        )}

        <h2>제품 정보</h2>
        <dl className="mpd-info-card">
          <div><dt>브랜드</dt><dd>{activeProduct.brand || "-"}</dd></div>
          <div><dt>품번</dt><dd>{skuSpec(activeProduct)}</dd></div>
          <div><dt>종류</dt><dd>{infoKind(activeProduct, category)}</dd></div>
          <div><dt>기준</dt><dd>{catalogSpec}</dd></div>
        </dl>

        <div className="mpd-note">
          <Info aria-hidden="true" />
          <span>{noteSpec}</span>
        </div>
      </section>

      <div className="mpd-bottom">
        <a className="mpd-kakao" href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer" aria-label="카카오톡 상담">
          <MessageCircle aria-hidden="true" />
        </a>
        <button className="mpd-primary" type="button" onClick={addAndReturn}>
          선택 담고 계속 <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </main>
  );
}
