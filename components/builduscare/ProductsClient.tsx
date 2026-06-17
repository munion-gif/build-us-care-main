"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EstimatePanel } from "@/components/builduscare/EstimatePanel";
import { openEstimatePreviewWindow } from "@/components/builduscare/estimate-preview-storage";
import { ProductDetailModal } from "@/components/builduscare/ProductDetailModal";
import { ProductFilterBar } from "@/components/builduscare/ProductFilterBar";
import { ProductGrid } from "@/components/builduscare/ProductGrid";
import { MobileAppBar } from "@/components/builduscare/MobileAppChrome";
import type { ProductSelection } from "@/components/builduscare/product-types";
import {
  PRODUCT_PAGE_SIZE,
  colorVariantChoices,
  colorChoiceLabel,
  defaultColor,
  formatKRW,
  hasProductChoiceVariants,
  isProductGroupSelected,
  normalizeSelectedColor,
  productGroupVariants,
  productDisplayLabel,
  productTotals,
  representativeProductList,
  sashSizeChoices,
  selectionKey,
  sortProducts,
  unique,
  usefulColor
} from "@/components/builduscare/product-helpers";
import type { BuilduscarePublicProduct } from "@/lib/builduscare-public-products";
import type { BuilduscareCategory } from "@/lib/builduscare-public-routes";

type ProductsClientProps = {
  category: BuilduscareCategory;
  categories: BuilduscareCategory[];
  products: BuilduscarePublicProduct[];
  groupNames: string[];
  catalogs?: ProductsCatalog[];
  initialStoredSelections?: StoredSelection[] | null;
  initialStoredOrderPrefs?: StoredOrderPrefs | null;
};

export type ProductsCatalog = {
  category: BuilduscareCategory;
  products: BuilduscarePublicProduct[];
  groupNames: string[];
};

const CATEGORY_ICONS: Record<string, string> = {
  toilet: "/assets/prodicon-toilet.webp",
  washbasin: "/assets/prodicon-washbasin.webp",
  faucet: "/assets/prodicon-faucet.webp",
  bidet: "/assets/prodicon-bidet.webp",
  ventilation: "/assets/prodicon-vent.webp",
  "window-handle": "/assets/prodicon-windowhandle.webp",
  "door-handle": "/assets/prodicon-doorhandle.webp",
  silicone: "/assets/prodicon-silicone.webp",
  "bath-accessory": "/assets/prodicon-accessory.webp"
};

const PRODUCT_SELECTIONS_STORAGE_KEY = "builduscare:productSelections";
const PRODUCT_ORDER_PREFS_STORAGE_KEY = "builduscare:productOrderPrefs";
const PRODUCT_SELECTIONS_COOKIE_KEY = "builduscare_productSelections";
const PRODUCT_ORDER_PREFS_COOKIE_KEY = "builduscare_productOrderPrefs";
const PRODUCT_STORAGE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const PRODUCT_MOBILE_PAGE_SIZE = 10;
const FAUCET_GROUP_ORDER = ["세면수전", "주방수전", "샤워욕조 수전", "샤워욕조수전", "레인샤워수전", "샤워수전"];
const FAUCET_GROUP_LABELS: Record<string, string> = {
  "샤워욕조 수전": "샤워욕조",
  "샤워욕조수전": "샤워욕조",
  "레인샤워수전": "레인샤워"
};
const GROUP_LABELS_BY_SERVICE: Record<string, Record<string, string>> = {
  faucet_replace: FAUCET_GROUP_LABELS,
  basin_replace: {
    "반다리 세면기": "반다리",
    "긴다리 세면기": "긴다리"
  },
  bath_accessory: {
    "욕실 악세서리 세트": "세트",
    "선반 및 수건걸이": "선반·수건걸이"
  }
};

type StoredSelection = {
  id?: string;
  selectedColor?: string;
  qty?: number;
  product?: BuilduscarePublicProduct;
};

type StoredOrderPrefs = {
  selfDisposal?: boolean;
  itemLabel?: string;
};

let productSelectionsMemory: StoredSelection[] | null = null;
let productOrderPrefsMemory: StoredOrderPrefs | null = null;

type ProductDraftMemory = {
  selections?: StoredSelection[] | null;
  orderPrefs?: StoredOrderPrefs | null;
};

declare global {
  interface Window {
    __builduscareProductDraft?: ProductDraftMemory;
  }
}

function storedProductSnapshot(value: unknown): BuilduscarePublicProduct | null {
  if (!value || typeof value !== "object") return null;
  const product = value as BuilduscarePublicProduct;
  if (!product.id || !product.serviceCode || !product.displayModel) return null;
  return product;
}

function storedSelectionPayload(selections: ProductSelection[]) {
  return selections.map((item) => ({
    id: item.product.id,
    selectedColor: normalizeSelectedColor(item.product, item.selectedColor),
    qty: item.qty
  }));
}

function findStoredProduct(row: StoredSelection, products: BuilduscarePublicProduct[]) {
  const snapshot = storedProductSnapshot(row.product);
  return products.find((item) => item.id === row.id)
    ?? products.find((item) => snapshot?.sku && item.serviceCode === snapshot.serviceCode && item.sku === snapshot.sku)
    ?? products.find((item) => snapshot?.displayModel && item.serviceCode === snapshot.serviceCode && item.displayModel === snapshot.displayModel)
    ?? products.find((item) => snapshot?.model && item.serviceCode === snapshot.serviceCode && item.model === snapshot.model)
    ?? snapshot;
}

function restoreProductSelections(rows: StoredSelection[] | null, products: BuilduscarePublicProduct[]) {
  if (!rows) return [];
  const restored: ProductSelection[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const product = findStoredProduct(row, products);
    if (!product) continue;
    const selectedColor = normalizeSelectedColor(product, row.selectedColor);
    const key = selectionKey(product, selectedColor);
    if (seen.has(key)) continue;
    seen.add(key);
    restored.push({ product, selectedColor, qty: Math.max(1, Math.min(20, Number(row.qty || 1))) });
  }
  return restored;
}

function selectionSignature(selections: ProductSelection[]) {
  return selections
    .map((item) => `${selectionKey(item.product, item.selectedColor)}:${item.qty}`)
    .sort()
    .join("|");
}

function parseStoredSelections(value: string | null): StoredSelection[] | null {
  if (!value) return null;
  try {
    const rows = JSON.parse(value) as StoredSelection[];
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

function parseStoredOrderPrefs(value: string | null): StoredOrderPrefs | null {
  if (!value) return null;
  try {
    const prefs = JSON.parse(value) as StoredOrderPrefs;
    return prefs && typeof prefs === "object" ? prefs : null;
  } catch {
    return null;
  }
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

function readClientStorage(key: string, cookieKey: string) {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  } catch {
    // Continue to fallbacks.
  }
  try {
    const value = window.sessionStorage.getItem(key);
    if (value) return value;
  } catch {
    // Continue to cookie fallback.
  }
  return readCookieValue(cookieKey);
}

function writeClientStorage(key: string, cookieKey: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Continue to fallbacks.
  }
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Continue to cookie fallback.
  }
  try {
    writeCookieValue(cookieKey, value);
  } catch {
    // Ignore unavailable client storage.
  }
}

function readStoredSelectionsFromClient() {
  return parseStoredSelections(readClientStorage(PRODUCT_SELECTIONS_STORAGE_KEY, PRODUCT_SELECTIONS_COOKIE_KEY))
    ?? window.__builduscareProductDraft?.selections
    ?? productSelectionsMemory;
}

function readStoredOrderPrefsFromClient() {
  return parseStoredOrderPrefs(readClientStorage(PRODUCT_ORDER_PREFS_STORAGE_KEY, PRODUCT_ORDER_PREFS_COOKIE_KEY))
    ?? window.__builduscareProductDraft?.orderPrefs
    ?? productOrderPrefsMemory;
}

function writeStoredProductDraft(selectionPayload: StoredSelection[], orderPrefs: StoredOrderPrefs) {
  if (typeof window !== "undefined") {
    window.__builduscareProductDraft = {
      selections: selectionPayload,
      orderPrefs
    };
  }
  writeClientStorage(PRODUCT_SELECTIONS_STORAGE_KEY, PRODUCT_SELECTIONS_COOKIE_KEY, JSON.stringify(selectionPayload));
  writeClientStorage(PRODUCT_ORDER_PREFS_STORAGE_KEY, PRODUCT_ORDER_PREFS_COOKIE_KEY, JSON.stringify(orderPrefs));
}

function slugFromProductPath(pathname: string) {
  const match = pathname.match(/^\/products\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function resolveProductGroup(raw: string | null, groupNames: string[], groupLabels?: Record<string, string>) {
  const value = String(raw ?? "").trim();
  if (!value) return "전체";
  if (groupNames.includes(value)) return value;
  const matched = Object.entries(groupLabels ?? {}).find(([, label]) => label === value)?.[0];
  return matched && groupNames.includes(matched) ? matched : "전체";
}

function readGroupParam(groupNames: string[], groupLabels?: Record<string, string>) {
  if (typeof window === "undefined") return "전체";
  return resolveProductGroup(new URLSearchParams(window.location.search).get("group"), groupNames, groupLabels);
}

function replaceProductGroupUrl(slug: string, nextGroup: string) {
  if (typeof window === "undefined") return;
  const url = new URL(`/products/${slug}`, window.location.origin);
  if (nextGroup && nextGroup !== "전체") url.searchParams.set("group", nextGroup);
  const nextUrl = `${url.pathname}${url.search}`;
  if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
    window.history.replaceState({ builduscareProductCategory: slug, builduscareProductGroup: nextGroup }, "", nextUrl);
  }
}

function readInitialSelections(rows: StoredSelection[] | null, products: BuilduscarePublicProduct[]) {
  if (typeof window !== "undefined") {
    const memoryRows = window.__builduscareProductDraft?.selections ?? productSelectionsMemory;
    if (memoryRows?.length) return restoreProductSelections(memoryRows, products);
  }
  return restoreProductSelections(rows ?? productSelectionsMemory, products);
}

function readInitialOrderPrefs(prefs: StoredOrderPrefs | null) {
  if (typeof window !== "undefined") {
    return window.__builduscareProductDraft?.orderPrefs ?? prefs ?? productOrderPrefsMemory;
  }
  return prefs ?? productOrderPrefsMemory;
}

function filterColorOptions(product: BuilduscarePublicProduct) {
  const source = product.colorOptions.length > 0
    ? product.colorOptions
    : [product.color];

  return source
    .flatMap((value) => String(value ?? "").split(/\s*[\/,]\s*/u))
    .map(colorChoiceLabel)
    .filter(usefulColor);
}

type QuickVariantPickerProps = {
  product: BuilduscarePublicProduct;
  products: BuilduscarePublicProduct[];
  selections: ProductSelection[];
  onClose: () => void;
  onSelect: (product: BuilduscarePublicProduct, selectedColor?: string) => void;
};

function QuickVariantPicker({ product, products, selections, onClose, onSelect }: QuickVariantPickerProps) {
  const sizeChoices = sashSizeChoices(product, products);
  const colorChoices = sizeChoices.length > 0 ? [] : colorVariantChoices(product, products);
  const isSashPicker = sizeChoices.length > 0;
  const title = isSashPicker ? "손잡이 사이즈 선택" : "색상 선택";
  const choices = isSashPicker
    ? sizeChoices.map((item) => ({
      key: item.size,
      title: item.size,
      price: item.product.roundedPrice,
      sub: item.product.color || "기본",
      product: item.product,
      selectedColor: defaultColor(item.product)
    }))
    : colorChoices.map((item) => ({
      key: item.color,
      title: item.color,
      price: item.product.roundedPrice,
      sub: item.product.sku || item.product.model || "",
      product: item.product,
      selectedColor: item.color
    }));

  return (
    <div className="quick-choice-scrim" role="presentation" onMouseDown={onClose}>
      <article className="bcard quick-choice-card" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="between">
          <div>
            <div className="h-md">{title}</div>
            <p className="p-sm mt4">{productDisplayLabel(product)}</p>
          </div>
          <button className="iconbtn" type="button" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <div className="sash-size-grid">
          {choices.map((choice) => {
            const selected = selections.some((item) => item.product.id === choice.product.id);
            return (
              <button
                key={choice.key}
                className={`sash-size-option${selected ? " selected" : ""}`}
                type="button"
                onClick={() => onSelect(choice.product, choice.selectedColor)}
              >
                <b>{choice.title}</b>
                <span>{formatKRW(choice.price)}</span>
                {choice.sub && <small>{choice.sub}</small>}
              </button>
            );
          })}
        </div>
        {isSashPicker && (
          <p className="p-sm mt12">선택한 사이즈가 장바구니에 담겨요. 같은 사이즈에 색상별 가격 차이가 있으면 최저가 기준으로 담습니다.</p>
        )}
      </article>
    </div>
  );
}

export function ProductsClient({
  category,
  categories,
  products: initialProducts,
  groupNames: initialGroupNames,
  catalogs,
  initialStoredSelections = null,
  initialStoredOrderPrefs = null
}: ProductsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const catalogList = useMemo<ProductsCatalog[]>(() => {
    return catalogs?.length
      ? catalogs
      : [{ category, products: initialProducts, groupNames: initialGroupNames }];
  }, [catalogs, category, initialGroupNames, initialProducts]);
  const catalogBySlug = useMemo(() => new Map(catalogList.map((item) => [item.category.slug, item])), [catalogList]);
  const allCatalogProducts = useMemo(() => catalogList.flatMap((item) => item.products), [catalogList]);
  const [currentSlug, setCurrentSlug] = useState(category.slug);
  const activeCatalog = catalogBySlug.get(currentSlug) ?? catalogBySlug.get(category.slug) ?? catalogList[0];
  const activeCategory = activeCatalog.category;
  const products = activeCatalog.products;
  const groupNames = activeCatalog.groupNames;
  const [group, setGroup] = useState("전체");
  const [sort, setSort] = useState("low");
  const [brand, setBrand] = useState("전체");
  const [color, setColor] = useState("전체");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<BuilduscarePublicProduct | null>(null);
  const [selections, setSelections] = useState<ProductSelection[]>(() => readInitialSelections(initialStoredSelections, allCatalogProducts));
  const [selfDisposal, setSelfDisposal] = useState(() => Boolean(readInitialOrderPrefs(initialStoredOrderPrefs)?.selfDisposal));
  const [quickChoice, setQuickChoice] = useState<BuilduscarePublicProduct | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [isMobileList, setIsMobileList] = useState(false);
  const selectionsRef = useRef(selections);
  const selfDisposalRef = useRef(selfDisposal);
  const storageReadyRef = useRef(storageReady);

  const baseProducts = useMemo(() => {
    return products.filter((product) => group === "전체" || product.categoryName === group);
  }, [group, products]);
  const brands = useMemo(() => unique(baseProducts.map((product) => product.brand)), [baseProducts]);
  const colors = useMemo(() => {
    const values = unique(baseProducts.flatMap(filterColorOptions)).filter((value) => value !== "-");
    return values.filter(usefulColor).length > 1 ? values : [];
  }, [baseProducts]);
  const categoryTitleByService = useMemo(() => Object.fromEntries(categories.map((item) => [item.serviceCode, item.title])), [categories]);
  const orderItemLabel = useMemo(() => {
    const labels = Array.from(new Set(selections.map((item) => categoryTitleByService[item.product.serviceCode] ?? activeCategory.title))).filter(Boolean);
    if (labels.length > 1) return `${labels.join(" + ")} 교체`;
    if (labels.length === 1) return `${labels[0]} 교체`;
    return activeCategory.itemLabel;
  }, [activeCategory.itemLabel, activeCategory.title, categoryTitleByService, selections]);

  function orderItemLabelFor(nextSelections: ProductSelection[]) {
    const labels = Array.from(new Set(nextSelections.map((item) => categoryTitleByService[item.product.serviceCode] ?? activeCategory.title))).filter(Boolean);
    if (labels.length > 1) return `${labels.join(" + ")} 교체`;
    if (labels.length === 1) return `${labels[0]} 교체`;
    return activeCategory.itemLabel;
  }

  function persistProductDraft(nextSelections: ProductSelection[], nextSelfDisposal = selfDisposalRef.current) {
    if (!storageReadyRef.current && nextSelections.length === 0) {
      const existingRows = typeof window !== "undefined" ? readStoredSelectionsFromClient() : productSelectionsMemory;
      if (existingRows?.length) return;
    }

    selectionsRef.current = nextSelections;
    selfDisposalRef.current = nextSelfDisposal;

    const selectionPayload = storedSelectionPayload(nextSelections);
    const orderPrefs = { selfDisposal: nextSelfDisposal, itemLabel: orderItemLabelFor(nextSelections) };
    productSelectionsMemory = selectionPayload;
    productOrderPrefsMemory = orderPrefs;

    writeStoredProductDraft(selectionPayload, orderPrefs);
  }

  function persistCurrentProductDraft() {
    persistProductDraft(selectionsRef.current, selfDisposalRef.current);
  }

  useEffect(() => {
    selectionsRef.current = selections;
  }, [selections]);

  useEffect(() => {
    selfDisposalRef.current = selfDisposal;
  }, [selfDisposal]);

  useEffect(() => {
    storageReadyRef.current = storageReady;
  }, [storageReady]);

  useEffect(() => {
    function persistBeforeLeavingProducts(event?: Event) {
      if (event?.type === "visibilitychange" && document.visibilityState !== "hidden") return;
      persistCurrentProductDraft();
    }

    function persistBeforeProductNavigation(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;

      const url = new URL(target.href, window.location.href);
      if (url.origin === window.location.origin && url.pathname.startsWith("/products")) {
        persistCurrentProductDraft();
      }
    }

    window.addEventListener("pagehide", persistBeforeLeavingProducts);
    window.addEventListener("beforeunload", persistBeforeLeavingProducts);
    document.addEventListener("visibilitychange", persistBeforeLeavingProducts);
    document.addEventListener("click", persistBeforeProductNavigation, true);
    return () => {
      window.removeEventListener("pagehide", persistBeforeLeavingProducts);
      window.removeEventListener("beforeunload", persistBeforeLeavingProducts);
      document.removeEventListener("visibilitychange", persistBeforeLeavingProducts);
      document.removeEventListener("click", persistBeforeProductNavigation, true);
    };
  }, []);

  useEffect(() => {
    const slug = slugFromProductPath(pathname);
    if (!slug || !catalogBySlug.has(slug)) return;
    setCurrentSlug((current) => {
      if (current === slug) return current;
      persistProductDraft(selectionsRef.current, selfDisposalRef.current);
      return slug;
    });
  }, [catalogBySlug, pathname]);

  useEffect(() => {
    const pathSlug = typeof window !== "undefined" ? slugFromProductPath(window.location.pathname) : slugFromProductPath(pathname);
    const nextSlug = pathSlug && catalogBySlug.has(pathSlug) ? pathSlug : category.slug;
    if (catalogBySlug.has(nextSlug)) {
      setCurrentSlug(nextSlug);
    }
  }, [catalogBySlug, category.slug, pathname]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 560px)");
    const update = () => setIsMobileList(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setGroup(readGroupParam(groupNames, GROUP_LABELS_BY_SERVICE[activeCategory.serviceCode]));
    setBrand("전체");
    setColor("전체");
    setPage(1);
  }, [activeCategory.serviceCode, currentSlug, groupNames]);

  useEffect(() => {
    document.title = `${activeCategory.title} | Build us Care`;
  }, [activeCategory.title]);

  useEffect(() => {
    if (brand !== "전체" && !brands.includes(brand)) setBrand("전체");
    if (color !== "전체" && !colors.includes(color)) setColor("전체");
  }, [brand, brands, color, colors]);

  useEffect(() => {
    try {
      const rows = readStoredSelectionsFromClient() ?? initialStoredSelections;
      const prefs = readStoredOrderPrefsFromClient() ?? initialStoredOrderPrefs;

      if (rows) {
        const restored = restoreProductSelections(rows, allCatalogProducts);
        setSelections((current) => {
          if (current.length > 0 && restored.length === 0) return current;
          return selectionSignature(current) === selectionSignature(restored) ? current : restored;
        });
      }
      if (prefs) setSelfDisposal(Boolean(prefs.selfDisposal));
    } catch {
      // Ignore unavailable or malformed local storage.
    } finally {
      setStorageReady(true);
    }
  }, [allCatalogProducts, initialStoredOrderPrefs, initialStoredSelections]);

  useEffect(() => {
    if (!storageReady) return;

    function syncDraftFromStorage() {
      const rows = readStoredSelectionsFromClient();
      const prefs = readStoredOrderPrefsFromClient();
      if (rows) {
        const restored = restoreProductSelections(rows, allCatalogProducts);
        setSelections((current) => {
          if (selectionSignature(current) === selectionSignature(restored)) return current;
          return restored;
        });
      }
      if (prefs) setSelfDisposal(Boolean(prefs.selfDisposal));
    }

    function syncOnPageShow() {
      syncDraftFromStorage();
    }

    function syncOnFocus() {
      syncDraftFromStorage();
    }

    function syncOnStorage(event: StorageEvent) {
      if (event.key && ![PRODUCT_SELECTIONS_STORAGE_KEY, PRODUCT_ORDER_PREFS_STORAGE_KEY].includes(event.key)) return;
      syncDraftFromStorage();
    }

    window.addEventListener("pageshow", syncOnPageShow);
    window.addEventListener("focus", syncOnFocus);
    window.addEventListener("storage", syncOnStorage);
    return () => {
      window.removeEventListener("pageshow", syncOnPageShow);
      window.removeEventListener("focus", syncOnFocus);
      window.removeEventListener("storage", syncOnStorage);
    };
  }, [allCatalogProducts, storageReady]);

  useEffect(() => {
    function syncCategoryFromHistory() {
      const slug = slugFromProductPath(window.location.pathname);
      if (slug && catalogBySlug.has(slug)) {
        setCurrentSlug(slug);
        return;
      }
      if (window.location.pathname === "/products") {
        router.push("/products");
      }
    }

    window.addEventListener("popstate", syncCategoryFromHistory);
    return () => window.removeEventListener("popstate", syncCategoryFromHistory);
  }, [catalogBySlug, router]);

  useEffect(() => {
    if (!storageReady) return;

    const selectionPayload = storedSelectionPayload(selections);
    const orderPrefs = { selfDisposal, itemLabel: orderItemLabel };
    productSelectionsMemory = selectionPayload;
    productOrderPrefsMemory = orderPrefs;

    writeStoredProductDraft(selectionPayload, orderPrefs);
  }, [orderItemLabel, selections, selfDisposal, storageReady]);

  const filteredProducts = useMemo(() => {
    return baseProducts.filter((product) => {
      if (brand !== "전체" && product.brand !== brand) return false;
      if (color !== "전체") {
        const options = filterColorOptions(product);
        if (!options.includes(color)) return false;
      }
      return true;
    });
  }, [baseProducts, brand, color]);

  const displayProducts = useMemo(() => {
    return sortProducts(representativeProductList(filteredProducts, filteredProducts), sort);
  }, [filteredProducts, sort]);

  const orderedGroupNames = useMemo(() => {
    if (activeCategory.serviceCode === "faucet_replace") {
      return [...groupNames].sort((a, b) => {
        const ai = FAUCET_GROUP_ORDER.indexOf(a);
        const bi = FAUCET_GROUP_ORDER.indexOf(b);
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        return a.localeCompare(b, "ko-KR");
      });
    }
    if (activeCategory.serviceCode === "bath_accessory") {
      const preferred = ["욕실 악세서리 세트", "선반 및 수건걸이"];
      return [...groupNames].sort((a, b) => {
        const ai = preferred.indexOf(a);
        const bi = preferred.indexOf(b);
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        return a.localeCompare(b, "ko-KR");
      });
    }
    if (activeCategory.serviceCode !== "toilet_replace") return groupNames;
    const preferred = ["원피스", "투피스"];
    return [...groupNames].sort((a, b) => {
      const ai = preferred.indexOf(a);
      const bi = preferred.indexOf(b);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.localeCompare(b, "ko-KR");
    });
  }, [activeCategory.serviceCode, groupNames]);
  const pageSize = isMobileList ? PRODUCT_MOBILE_PAGE_SIZE : PRODUCT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(displayProducts.length / pageSize));
  const pageProducts = useMemo(
    () => displayProducts.slice((page - 1) * pageSize, page * pageSize),
    [displayProducts, page, pageSize]
  );
  const totals = productTotals(selections, selfDisposal);

  useEffect(() => {
    if (!isMobileList) return;
    pageProducts.slice(0, 6).forEach((product) => {
      router.prefetch(`/products/${activeCategory.slug}/${encodeURIComponent(product.id)}`);
    });
  }, [activeCategory.slug, isMobileList, pageProducts, router]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function resetPage(next: () => void) {
    next();
    setPage(1);
  }

  function goToProductPage(nextPage: number) {
    setPage(nextPage);
    window.requestAnimationFrame(() => {
      document.getElementById("wpList")?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  }

  function openDetail(product: BuilduscarePublicProduct) {
    if (isMobileList) {
      persistProductDraft(selectionsRef.current, selfDisposalRef.current);
      router.push(`/products/${activeCategory.slug}/${encodeURIComponent(product.id)}`);
      return;
    }
    setDetail(product);
  }

  function changeCategory(nextSlug: string) {
    if (nextSlug === currentSlug || !catalogBySlug.has(nextSlug)) return;
    persistProductDraft(selectionsRef.current, selfDisposalRef.current);
    setGroup("전체");
    setBrand("전체");
    setColor("전체");
    setPage(1);
    setDetail(null);
    setCurrentSlug(nextSlug);
    const nextPath = `/products/${nextSlug}`;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ builduscareProductCategory: nextSlug }, "", nextPath);
    }
  }

  function selectVariant(product: BuilduscarePublicProduct, selectedColor = defaultColor(product)) {
    const normalizedColor = normalizeSelectedColor(product, selectedColor);
    const key = selectionKey(product, normalizedColor);
    const variants = productGroupVariants(product, allCatalogProducts);
    setSelections((current) => {
      const existing = current.find((item) => selectionKey(item.product, item.selectedColor) === key);
      if (existing) return current;
      const withoutGroup = current.filter((item) => !variants.some((variant) => variant.id === item.product.id));
      const next = [...withoutGroup, { product, selectedColor: normalizedColor, qty: 1 }];
      persistProductDraft(next);
      return next;
    });
  }

  function toggleSelection(product: BuilduscarePublicProduct, selectedColor = defaultColor(product)) {
    const normalizedColor = normalizeSelectedColor(product, selectedColor);
    const variants = productGroupVariants(product, allCatalogProducts);
    setSelections((current) => {
      const next = isProductGroupSelected(current, product, allCatalogProducts)
        ? current.filter((item) => !variants.some((variant) => variant.id === item.product.id))
        : [...current, { product, selectedColor: normalizedColor, qty: 1 }];
      persistProductDraft(next);
      return next;
    });
  }

  function quickSelect(product: BuilduscarePublicProduct) {
    if (isProductGroupSelected(selections, product, allCatalogProducts)) {
      toggleSelection(product, defaultColor(product));
      return;
    }

    if (hasProductChoiceVariants(product, allCatalogProducts)) {
      setQuickChoice(product);
      return;
    }
    toggleSelection(product, defaultColor(product));
  }

  function chooseQuickVariant(product: BuilduscarePublicProduct, selectedColor = defaultColor(product)) {
    selectVariant(product, selectedColor);
    setQuickChoice(null);
  }

  function handleDetailBuy(sourceProduct: BuilduscarePublicProduct, selectedProduct: BuilduscarePublicProduct, selectedColor: string) {
    if (!hasProductChoiceVariants(sourceProduct, allCatalogProducts)) {
      const normalizedColor = normalizeSelectedColor(selectedProduct, selectedColor);
      const key = selectionKey(selectedProduct, normalizedColor);
      const variants = productGroupVariants(selectedProduct, allCatalogProducts);
      setSelections((current) => {
        const existing = current.find((item) => selectionKey(item.product, item.selectedColor) === key);
        const withoutGroup = current.filter((item) => !variants.some((variant) => variant.id === item.product.id));
        const next = existing ? withoutGroup : [...withoutGroup, { product: selectedProduct, selectedColor: normalizedColor, qty: 1 }];
        persistProductDraft(next);
        return next;
      });
      return;
    }

    const normalizedColor = normalizeSelectedColor(selectedProduct, selectedColor);
    const key = selectionKey(selectedProduct, normalizedColor);
    const variants = productGroupVariants(sourceProduct, allCatalogProducts);
    setSelections((current) => {
      const existing = current.find((item) => selectionKey(item.product, item.selectedColor) === key);
      const withoutGroup = current.filter((item) => !variants.some((variant) => variant.id === item.product.id));
      const next = existing ? withoutGroup : [...withoutGroup, { product: selectedProduct, selectedColor: normalizedColor, qty: 1 }];
      persistProductDraft(next);
      return next;
    });
  }

  function removeSelection(key: string) {
    setSelections((current) => {
      const next = current.filter((item) => selectionKey(item.product, item.selectedColor) !== key);
      persistProductDraft(next);
      return next;
    });
  }

  function adjustSelection(key: string, delta: number) {
    setSelections((current) => {
      const next = current.flatMap((item) => {
        if (selectionKey(item.product, item.selectedColor) !== key) return [item];
        const qty = Math.max(0, Math.min(20, item.qty + delta));
        return qty <= 0 ? [] : [{ ...item, qty }];
      });
      persistProductDraft(next);
      return next;
    });
  }

  function toggleSelfDisposal() {
    setSelfDisposal((current) => {
      const next = !current;
      persistProductDraft(selections, next);
      return next;
    });
  }

  function openReservationFlow() {
    const currentSelections = selectionsRef.current;
    const currentSelfDisposal = selfDisposalRef.current;
    if (currentSelections.length === 0) return;
    writeStoredProductDraft(storedSelectionPayload(currentSelections), {
      selfDisposal: currentSelfDisposal,
      itemLabel: orderItemLabelFor(currentSelections)
    });
    router.push("/reservation/info");
  }

  function openEstimatePreview() {
    const currentSelections = selectionsRef.current;
    if (currentSelections.length === 0) return;
    openEstimatePreviewWindow({
      categoryTitle: activeCategory.title,
      allProducts: allCatalogProducts,
      selections: currentSelections,
      productAmount: totals.productAmount,
      laborAmount: totals.laborAmount,
      disposalAmount: totals.disposalAmount,
      totalAmount: totals.totalAmount,
      selfDisposal,
      categoryTitleByService,
      title: "견적서"
    });
  }

  return (
    <main className="bc-page products-category-page">
      <MobileAppBar title={activeCategory.title} subtitle={activeCategory.english} backHref="/products" showSearch />
      <div className="wrap">
        <div className="stepline" aria-label="진행 단계">
          <span className="on">제품 선택</span><ChevronRight aria-hidden="true" /><span>사진 확인</span><ChevronRight aria-hidden="true" /><span>예약</span><ChevronRight aria-hidden="true" /><span>접수</span>
        </div>
        <h1 id="wpTitle" className="web-h2" style={{ margin: "14px 0 18px" }}>{activeCategory.title} <span className="enlabel">{activeCategory.english}</span></h1>
        <section>
          <nav className="cat-nav" aria-label="제품 품목">
            {categories.map((item) => (
              <button
                key={item.slug}
                type="button"
                className={`cat-item ${item.slug === activeCategory.slug ? "on" : ""}`}
                onClick={() => changeCategory(item.slug)}
              >
                <span className="cat-thumb">
                  <img src={CATEGORY_ICONS[item.slug] ?? item.image} alt="" decoding="async" width={64} height={64} />
                </span>
                <span className="cat-lbl">{item.title}</span>
              </button>
            ))}
          </nav>
          <p className="cat-desc-out">바꿀 품목을 자유롭게 넘나들며 담아보세요. 여러 품목을 함께 담으면 <b>한 번의 방문</b>으로 교체하고, 견적도 한 장으로 받아볼 수 있어요.</p>
        </section>

        <div className="split products-split" style={{ marginTop: 32 }}>
          <section id="wpList">
            <h2 className="h-md" style={{ marginBottom: 12 }}>전체 제품 ({displayProducts.length})</h2>
            <ProductFilterBar
              group={group}
              sort={sort}
              brand={brand}
              color={color}
              groupNames={orderedGroupNames}
              groupLabels={GROUP_LABELS_BY_SERVICE[activeCategory.serviceCode]}
              brands={brands}
              colors={colors}
              onGroupChange={(value) => resetPage(() => {
                setGroup(value);
                setBrand("전체");
                setColor("전체");
                replaceProductGroupUrl(activeCategory.slug, value);
              })}
              onSortChange={(value) => resetPage(() => setSort(value))}
              onBrandChange={(value) => resetPage(() => setBrand(value))}
              onColorChange={(value) => resetPage(() => setColor(value))}
              onClearFilters={() => {
                setGroup("전체");
                setBrand("전체");
                setColor("전체");
                setPage(1);
                replaceProductGroupUrl(activeCategory.slug, "전체");
              }}
            />
            <ProductGrid
              category={activeCategory}
              products={pageProducts}
              allProducts={allCatalogProducts}
              selections={selections}
              onOpenDetail={openDetail}
              onQuickSelect={quickSelect}
            />
            <div className="product-pager">
              <button className="pager-btn" type="button" aria-disabled={page <= 1} disabled={page <= 1} onClick={() => goToProductPage(Math.max(1, page - 1))} aria-label="이전 제품">
                <ChevronLeft size={18} />
                이전
              </button>
              <span className="pager-state">
                <small>{page} / {totalPages} 페이지</small>
              </span>
              <button className="pager-btn" type="button" aria-disabled={page >= totalPages} disabled={page >= totalPages} onClick={() => goToProductPage(Math.min(totalPages, page + 1))} aria-label="다음 제품">
                다음
                <ChevronRight size={18} />
              </button>
            </div>
            <a className="web-btn kkbtn" style={{ marginTop: 18 }} href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer">원하는 제품이 따로 있어요</a>
          </section>

            <EstimatePanel
              category={activeCategory}
              allProducts={allCatalogProducts}
              selections={selections}
              units={totals.units}
              productAmount={totals.productAmount}
              laborAmount={totals.laborAmount}
              disposalAmount={totals.disposalAmount}
              totalAmount={totals.totalAmount}
              selfDisposal={selfDisposal}
              onAdjustSelection={adjustSelection}
              onToggleSelfDisposal={toggleSelfDisposal}
              onRemoveSelection={removeSelection}
              categoryTitleByService={categoryTitleByService}
              onOpenEstimate={openEstimatePreview}
              onOpenOrderForm={openReservationFlow}
            />
        </div>

        {quickChoice && (
          <QuickVariantPicker
            product={quickChoice}
            products={allCatalogProducts}
            selections={selections}
            onClose={() => setQuickChoice(null)}
            onSelect={chooseQuickVariant}
          />
        )}

      </div>

      <div className="bc-mobile-only cartbar mobile-estimate-bar" id="mCartbar" aria-live="polite">
        <div className="grow">
          <b>{selections.length}개 선택</b>
          <span>제품가 합계 {totals.productAmount.toLocaleString("ko-KR")}원</span>
        </div>
        <button
          className="btn btn-primary btn-lg"
          type="button"
          aria-disabled={selections.length === 0}
          disabled={selections.length === 0}
          onClick={openReservationFlow}
        >
          예약 정보 입력
        </button>
      </div>

      {detail && (
        <ProductDetailModal
          category={activeCategory}
          product={detail}
          products={allCatalogProducts}
          selections={selections}
          onClose={() => setDetail(null)}
          onBuy={handleDetailBuy}
        />
      )}
    </main>
  );
}
