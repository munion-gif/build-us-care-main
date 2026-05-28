"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Info, MapPin, MessageCircle } from "lucide-react";
import { AddressModal, type AddressSelection } from "@/components/common/AddressModal";
import { PhotoUploader } from "@/components/quote/PhotoUploader";
import { QuoteStickySummary } from "@/components/quote/QuoteStickySummary";
import { customerErrorMessage } from "@/lib/error-messages";
import { EVENT_TYPES } from "@/lib/event-types";
import { formatKRDate, formatServiceName } from "@/lib/format";
import { getKakaoChannelChatUrl } from "@/lib/kakao-channel";
import { customerPhotoSlot } from "@/lib/photo-guides";
import type { MaterialItem, QuoteServiceItem } from "@/lib/service-items";
import type { QuotePreset } from "@/lib/quote-preset";
import { regionLabel } from "@/lib/quote-preset";
import {
  getProductLaborPrice,
  getReplacementProductCatalog,
  replacementProductSnapshot,
  type ReplacementProduct
} from "@/lib/replacement-products";
import { getSessionId, getUtmParams } from "@/lib/tracking";
import { useTracking } from "@/lib/use-tracking";

type QuoteDetailClientProps = {
  service: QuoteServiceItem;
  materials: MaterialItem[];
  preset: QuotePreset;
  kakaoUrl: string | null;
};

type TossPaymentClient = {
  requestPayment: (params: {
    method: "CARD" | "TRANSFER";
    amount: { currency: "KRW"; value: number };
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerName?: string;
    customerMobilePhone?: string;
    windowTarget?: "self" | "iframe";
    card?: { flowMode?: "DEFAULT" | "DIRECT" };
  }) => Promise<void>;
};

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      payment: (params: { customerKey: string }) => TossPaymentClient;
    };
  }
}

type AddressForm = {
  road_address: string;
  detail_address: string;
  postal_code: string;
};

type SlotPeriod = "morning" | "afternoon";
type PaymentMethod = "CARD" | "TRANSFER";
type SlotsByDate = Record<string, SlotPeriod[]>;
type SlotDay = {
  date: string;
  allFull: boolean;
  blocked: boolean;
  hasReservation?: boolean;
  beforeMinDate: boolean;
  slots: Record<SlotPeriod, { isFull: boolean; usedCount: number; maxCount: number; available?: boolean }>;
};

type PreviousOrder = {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  service_type_code?: string | null;
  skus?: Array<{ sku?: string; service_type_code?: string }> | null;
  jobs?: Array<{ assigned_technician_name?: string | null; status?: string | null; completed_at?: string | null }> | null;
};

const VISIT_FEE = 15000;
const MAX_REPLACEMENT_PRODUCT_QTY = 20;
const PRODUCT_RECOMMEND_LABEL_ORDER = ["가성비", "인기", "프리미엄"];
const PREFERRED_BRANDS = ["대림바스", "아메리칸스탠다드", "대림", "도비도스", "이누스"];
const PRODUCT_PRICE_FILTERS = [
  { id: "all", label: "전체 가격대", min: 0, max: Number.POSITIVE_INFINITY },
  { id: "under-200000", label: "20만원 미만", min: 0, max: 200000 },
  { id: "200000-300000", label: "20만원대", min: 200000, max: 300000 },
  { id: "300000-500000", label: "30~49만원", min: 300000, max: 500000 },
  { id: "500000-1000000", label: "50~99만원", min: 500000, max: 1000000 },
  { id: "over-1000000", label: "100만원 이상", min: 1000000, max: Number.POSITIVE_INFINITY }
] as const;

type ProductPriceFilterId = (typeof PRODUCT_PRICE_FILTERS)[number]["id"];

function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    bathroom: "욕실",
    kitchen: "주방",
    lighting: "조명",
    electric: "전기",
    door: "문/손잡이",
    service: "서비스"
  };
  return labels[category] ?? category;
}

function minReservationIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return toIsoDate(date);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthLabel(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function buildCalendarDays(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function isValidKoreanMobile(phone: string) {
  return /^010\d{8}$/.test(normalizePhone(phone));
}

function loadTossSdk() {
  if (typeof window === "undefined") return Promise.reject(new Error("브라우저에서만 결제를 시작할 수 있어요."));
  if (window.TossPayments) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-toss-payments="v2"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("토스 결제 모듈을 불러오지 못했어요.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.tosspayments.com/v2/standard";
    script.async = true;
    script.dataset.tossPayments = "v2";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("토스 결제 모듈을 불러오지 못했어요."));
    document.head.appendChild(script);
  });
}

function quoteDraftStorageKey(serviceCode: string) {
  return `buildus:quote-draft:${serviceCode}`;
}

function quotePaymentStorageKey(serviceCode: string) {
  return `buildus:quote-payment:${serviceCode}`;
}

type PaymentReady = {
  orderId: string;
  accessToken: string;
  totalFinal: number;
  paymentAmount: number;
  onsiteAmount: number;
  orderName: string;
};

type PreparedPayment = {
  orderId: string;
  internalOrderId: string;
  accessToken?: string;
  orderName: string;
  amount: number;
  productAmount: number;
  serviceFeeAmount: number;
  totalAmount: number;
  onsitePaymentAmount: number;
};

function normalizeDraftAddress(value: Partial<AddressForm> | undefined): AddressForm {
  return {
    road_address: value?.road_address ?? "",
    detail_address: value?.detail_address ?? "",
    postal_code: value?.postal_code ?? ""
  };
}

function normalizeDraftCustomer(value: Partial<{ name: string; phone: string }> | undefined) {
  return {
    name: value?.name ?? "",
    phone: value?.phone ?? ""
  };
}

function replacementProductMetadata(product: ReplacementProduct) {
  const snapshot = replacementProductSnapshot(product);
  return {
    selected_replacement_product_id: product.id,
    selected_replacement_product_service_code: product.serviceCode,
    selected_replacement_product: snapshot,
    ...(product.serviceCode === "toilet_replace"
      ? {
          selected_toilet_product_id: product.id,
          selected_toilet_product: snapshot
        }
      : {})
  };
}

function matchesProductFilters(product: ReplacementProduct, brandFilter: string, priceFilter: ProductPriceFilterId) {
  const activePriceFilter = PRODUCT_PRICE_FILTERS.find((filter) => filter.id === priceFilter) ?? PRODUCT_PRICE_FILTERS[0];
  const brandMatches = brandFilter === "all" || product.brand === brandFilter;
  const priceMatches =
    priceFilter === "all" ||
    (typeof product.price === "number" && product.price >= activePriceFilter.min && product.price < activePriceFilter.max);
  return brandMatches && priceMatches;
}

function sortedBrandOptions(products: ReplacementProduct[]) {
  const brands = Array.from(new Set(products.map((product) => product.brand).filter(Boolean)));
  return brands.sort((a, b) => {
    const aIndex = PREFERRED_BRANDS.indexOf(a);
    const bIndex = PREFERRED_BRANDS.indexOf(b);
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? Number.POSITIVE_INFINITY : aIndex) - (bIndex === -1 ? Number.POSITIVE_INFINITY : bIndex);
    }
    return a.localeCompare(b, "ko");
  });
}

function recommendationSortValue(product: ReplacementProduct) {
  const index = PRODUCT_RECOMMEND_LABEL_ORDER.indexOf(product.recommendLabel ?? "");
  return index === -1 ? PRODUCT_RECOMMEND_LABEL_ORDER.length : index;
}

function productDisplaySort(a: ReplacementProduct, b: ReplacementProduct) {
  const aPrice = typeof a.price === "number" ? a.price : Number.POSITIVE_INFINITY;
  const bPrice = typeof b.price === "number" ? b.price : Number.POSITIVE_INFINITY;
  if (aPrice !== bPrice) return aPrice - bPrice;

  const categoryOrder = a.categoryName.localeCompare(b.categoryName, "ko");
  if (categoryOrder !== 0) return categoryOrder;

  return `${a.model} ${a.sku}`.localeCompare(`${b.model} ${b.sku}`, "ko");
}

function compactProductNote(note: string) {
  const cleaned = note
    .replace(/[★]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const firstSegment = cleaned.split(/[,.，、]/).map((part) => part.trim()).find(Boolean) ?? cleaned;
  if (firstSegment.length <= 12) return firstSegment;

  const words = firstSegment.split(/\s+/).filter(Boolean);
  const compactWords: string[] = [];
  for (const word of words) {
    const next = [...compactWords, word].join(" ");
    if (next.length > 12) break;
    compactWords.push(word);
  }

  return compactWords.length > 0 ? compactWords.join(" ") : firstSegment.slice(0, 12).trim();
}

export function QuoteDetailClient({ service, materials, preset, kakaoUrl }: QuoteDetailClientProps) {
  const productGrade: "standard" = "standard";
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [address, setAddress] = useState<AddressForm>({ road_address: "", detail_address: "", postal_code: "" });
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [requestNote, setRequestNote] = useState("");
  const [previousOrders, setPreviousOrders] = useState<PreviousOrder[]>([]);
  const [previousOrdersLoading, setPreviousOrdersLoading] = useState(false);
  const [date, setDate] = useState(minReservationIsoDate());
  const [slot, setSlot] = useState<SlotPeriod>("morning");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(`${minReservationIsoDate()}T00:00:00`));
  const [slotsByDate, setSlotsByDate] = useState<SlotsByDate>({});
  const [closedSlotsByDate, setClosedSlotsByDate] = useState<SlotsByDate>({});
  const [slotDaysByDate, setSlotDaysByDate] = useState<Record<string, SlotDay>>({});
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsReady, setSlotsReady] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [slotsReloadKey, setSlotsReloadKey] = useState(0);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [activeFormStep, setActiveFormStep] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");
  const productSectionRef = useRef<HTMLDivElement | null>(null);
  const addressSectionRef = useRef<HTMLElement | null>(null);
  const scheduleSectionRef = useRef<HTMLElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const addressButtonRef = useRef<HTMLButtonElement | null>(null);
  const detailAddressInputRef = useRef<HTMLInputElement | null>(null);
  const { track } = useTracking();
  const kakaoChatUrl = getKakaoChannelChatUrl(kakaoUrl);

  const standardMaterial = materials.find((material) => material.sku === service.standard_material_sku) ?? materials[0];
  const selectedMaterial = standardMaterial;
  const productCatalog = useMemo(() => getReplacementProductCatalog(service.service_type_code), [service.service_type_code]);
  const showProductCatalog = Boolean(productCatalog);
  const selectedProductItems = useMemo(
    () =>
      productCatalog
        ? productCatalog.products.map((product) => ({
            product,
            qty: Math.max(0, Math.min(MAX_REPLACEMENT_PRODUCT_QTY, Math.floor(productQuantities[product.id] ?? 0)))
          })).filter((item) => item.qty > 0 && typeof item.product.price === "number")
        : [],
    [productCatalog, productQuantities]
  );
  const totalProductQty = selectedProductItems.reduce((sum, item) => sum + item.qty, 0);
  const selectedAddonItems: MaterialItem[] = [];
  const addonTotal = 0;
  const selectedProductPrice = showProductCatalog ? selectedProductItems.reduce((sum, item) => sum + (item.product.price ?? 0) * item.qty, 0) : selectedMaterial?.retail_price ?? 0;
  const serviceLaborPrice = showProductCatalog ? getProductLaborPrice(service.service_type_code) : service.base_price;
  const quoteVisitFee = showProductCatalog ? 0 : VISIT_FEE;
  const startLaborPrice = serviceLaborPrice + quoteVisitFee;
  const startProductPrice = productCatalog ? productCatalog.minPrice : standardMaterial?.retail_price ?? 0;
  const displayedStartPrice = startLaborPrice + startProductPrice;
  const serviceLaborTotal = showProductCatalog ? serviceLaborPrice * totalProductQty : serviceLaborPrice;
  const total = serviceLaborTotal + selectedProductPrice + addonTotal + quoteVisitFee;
  const onlinePaymentTotal = showProductCatalog ? selectedProductPrice : total;
  const onsitePaymentTotal = showProductCatalog ? serviceLaborTotal : 0;
  const laborPriceHelp = showProductCatalog ? `${service.display_name} 기본 시공비` : "기본 시공비와 방문비 포함";
  const todayIso = toIsoDate(new Date());
  const minSelectableDate = minReservationIsoDate();
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const selectableDatesInMonth = useMemo(() => {
    if (!slotsReady) return 0;
    return Object.entries(slotDaysByDate).filter(([dateText, day]) => {
      if (dateText.slice(0, 7) !== `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`) return false;
      return !day.beforeMinDate && !day.blocked && !day.allFull;
    }).length;
  }, [calendarMonth, slotDaysByDate, slotsReady]);
  const mockPaymentMode = process.env.NEXT_PUBLIC_PAYMENT_MOCK_MODE === "true";
  const tossReady = Boolean(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY);
  const paymentAvailable = mockPaymentMode || tossReady;
  const customerName = String(customer?.name ?? "");
  const customerPhone = String(customer?.phone ?? "");
  const hasRequiredBasicInfo = Boolean(address.road_address && address.detail_address.trim() && customerName.trim() && isValidKoreanMobile(customerPhone));
  const materialSkus = useMemo(
    () => (showProductCatalog ? [] : [selectedMaterial?.sku].filter(Boolean)) as string[],
    [selectedMaterial?.sku, showProductCatalog]
  );
  const selectedProductSummaryText = selectedProductItems.length === 0
    ? `${service.display_name} · 제품 선택 전`
    : selectedProductItems.length === 1
      ? `${service.display_name} · ${selectedProductItems[0].product.model}`
      : `${service.display_name} · ${selectedProductItems.length}개 제품 / 총 ${totalProductQty}개`;
  const primarySelectedProduct = selectedProductItems[0]?.product;
  const selectedProductBrief = primarySelectedProduct
    ? `${primarySelectedProduct.brand} ${primarySelectedProduct.model}${selectedProductItems.length > 1 ? ` 외 ${selectedProductItems.length - 1}개` : ""}`
    : "제품을 선택해주세요.";
  const selectedProductMeta = selectedProductItems.length > 0
    ? `${selectedProductItems.length}개 모델 · 총 ${totalProductQty}개`
    : `${productCatalog?.customConsultLabel ?? "제품"}을 선택하면 결제 금액이 계산됩니다.`;
  const productSelectionReady = !showProductCatalog || selectedProductItems.length > 0;
  const displayTotal = showProductCatalog && !productSelectionReady ? "제품 선택 후 계산" : won(onlinePaymentTotal);
  const mobileSummaryLabel = showProductCatalog
    ? productSelectionReady
      ? `선택 제품 ${totalProductQty}개`
      : "제품을 선택해주세요"
    : service.display_name;
  const orderFingerprint = useMemo(
    () =>
      JSON.stringify({
        serviceCode: service.service_type_code,
        address,
        customer: { name: customerName.trim(), phone: normalizePhone(customerPhone) },
        date,
        slot,
        productGrade,
        productQuantities,
        materialSkus,
        requestNote,
        files: files.map((file) => `${file.name}:${file.size}:${file.lastModified}`)
      }),
    [address, customerName, customerPhone, date, files, materialSkus, productQuantities, requestNote, service.service_type_code, slot]
  );
  const availableSlotsForDate = (dateText: string): SlotPeriod[] => {
    if (!slotsReady) return [];
    if (dateText < minSelectableDate) return [];
    const day = slotDaysByDate[dateText];
    if (day) {
      if (day.beforeMinDate || day.blocked || day.allFull) return [];
      return (["morning", "afternoon"] as SlotPeriod[]).filter((period) => !day.slots[period]?.isFull);
    }
    return slotsByDate[dateText] ?? ["morning", "afternoon"];
  };
  const selectedScheduleReady = slotsReady && !slotsError && availableSlotsForDate(date).includes(slot);

  function scrollToTarget(target: HTMLElement | null, focusTarget?: HTMLElement | null) {
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (focusTarget) {
      window.setTimeout(() => focusTarget.focus({ preventScroll: true }), 260);
    }
  }

  function moveToFormStep(step: number, section: HTMLElement | null, focusTarget?: HTMLElement | null) {
    setActiveFormStep(step);
    window.requestAnimationFrame(() => scrollToTarget(section, focusTarget));
  }

  function moveToProductSelection() {
    setMessage(`${productCatalog?.customConsultLabel ?? "제품"} 제품을 먼저 선택해주세요.`);
    window.requestAnimationFrame(() => scrollToTarget(productSectionRef.current));
  }

  function focusFirstBasicInfoError(errors: Record<string, string>) {
    const firstTarget =
      errors.name ? nameInputRef.current :
      errors.phone ? phoneInputRef.current :
      errors.address ? addressButtonRef.current :
      errors.detail_address ? detailAddressInputRef.current :
      null;
    moveToFormStep(0, addressSectionRef.current, firstTarget);
  }

  function moveToScheduleStep(messageText?: string) {
    if (messageText) setMessage(messageText);
    moveToFormStep(1, scheduleSectionRef.current);
  }

  function basicInfoErrors() {
    const nextErrors: Record<string, string> = {};
    if (!address.road_address) nextErrors.address = "주소를 먼저 입력해주세요.";
    if (!address.detail_address.trim()) nextErrors.detail_address = "동/호수 또는 층 정보를 입력해주세요.";
    if (!customerName.trim()) nextErrors.name = "이름을 입력해주세요.";
    if (!isValidKoreanMobile(customerPhone)) nextErrors.phone = "전화번호를 010-XXXX-XXXX 형식으로 입력해주세요.";
    return nextErrors;
  }

  function scheduleBlockMessage() {
    if (slotsLoading || !slotsReady) return "예약 가능 시간을 확인하고 있어요. 잠시 후 다시 시도해주세요.";
    return slotsError || "방문 가능한 날짜와 시간대를 선택해주세요.";
  }

  function handlePaymentBlocked() {
    if (showProductCatalog && selectedProductItems.length === 0) {
      moveToProductSelection();
      return true;
    }

    const nextErrors = basicInfoErrors();
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setMessage(Object.values(nextErrors)[0]);
      focusFirstBasicInfoError(nextErrors);
      return true;
    }

    setFieldErrors({});
    if (!selectedScheduleReady) {
      moveToScheduleStep(scheduleBlockMessage());
      return true;
    }

    return false;
  }

  function replaceProduct(productId: string) {
    setProductQuantities({ [productId]: 1 });
  }

  function setProductQty(productId: string, qty: number) {
    setProductQuantities((current) => {
      const nextQty = Math.max(0, Math.min(MAX_REPLACEMENT_PRODUCT_QTY, Math.floor(qty)));
      const next = { ...current };
      if (nextQty <= 0) {
        delete next[productId];
        return next;
      }
      next[productId] = nextQty;
      return next;
    });
  }

  function changeProductQty(productId: string, delta: number) {
    const currentQty = productQuantities[productId] ?? 0;
    setProductQty(productId, currentQty + delta);
  }

  useEffect(() => {
    if (!productCatalog) return;
    setProductQuantities((current) => {
      const validProductIds = new Set(productCatalog.products.map((product) => product.id));
      const next: Record<string, number> = {};
      for (const [productId, qty] of Object.entries(current)) {
        if (validProductIds.has(productId) && qty > 0) next[productId] = qty;
      }
      return next;
    });
  }, [productCatalog]);

  useEffect(() => {
    if (hasRequiredBasicInfo) {
      setActiveFormStep((current) => Math.max(current, 1));
    }
  }, [hasRequiredBasicInfo]);

  useEffect(() => {
    if (date < minSelectableDate) setDate(minSelectableDate);
  }, [date, minSelectableDate]);

  useEffect(() => {
    if (!mockPaymentMode && tossReady) {
      void loadTossSdk().catch(() => undefined);
    }
  }, [mockPaymentMode, tossReady]);

  useEffect(() => {
    if (preset.source === "instagram") {
      void track(EVENT_TYPES.LANDING_VIEW, {
        service_code: service.service_type_code,
        source: "instagram",
        campaign: preset.campaign,
        landing_path: window.location.pathname,
        region_code: preset.region
      });
    }
    void track(EVENT_TYPES.QUOTE_STARTED, { service_code: service.service_type_code, region_code: preset.region });
    void track(EVENT_TYPES.QUOTE_PAGE_VIEW, { service_code: service.service_type_code });
    const params = new URLSearchParams(window.location.search);
    if (params.get("toss") === "fail") {
      setMessage("결제가 취소되었습니다. 다시 시도해주세요.");
      void track(EVENT_TYPES.PAYMENT_FAILED, { service_code: service.service_type_code, order_id: params.get("orderId") ?? undefined });
      params.delete("toss");
      window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`);
    }

    const rawDraft = sessionStorage.getItem(quoteDraftStorageKey(service.service_type_code));
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as {
        address?: Partial<AddressForm>;
        customer?: Partial<{ name: string; phone: string }>;
        date?: string;
        slot?: "morning" | "afternoon";
        selectedProductId?: string;
        productQuantities?: Record<string, number>;
        selectedToiletProductId?: string;
        toiletProductQuantities?: Record<string, number>;
        requestNote?: string;
      };
      if (draft.address) setAddress(normalizeDraftAddress(draft.address));
      if (draft.customer) setCustomer(normalizeDraftCustomer(draft.customer));
      if (draft.date && draft.date >= minReservationIsoDate()) setDate(draft.date);
      if (draft.slot) setSlot(draft.slot);
      const savedProductQuantities = draft.productQuantities ?? draft.toiletProductQuantities;
      if (productCatalog && savedProductQuantities && Object.keys(savedProductQuantities).length > 0) {
        const nextQuantities: Record<string, number> = {};
        for (const [productId, qty] of Object.entries(savedProductQuantities)) {
          if (productCatalog.products.some((product) => product.id === productId)) {
            nextQuantities[productId] = Math.max(0, Math.min(MAX_REPLACEMENT_PRODUCT_QTY, Math.floor(qty)));
          }
        }
        if (Object.values(nextQuantities).some((qty) => qty > 0)) {
          setProductQuantities(nextQuantities);
        }
      } else if (productCatalog && (draft.selectedProductId || draft.selectedToiletProductId)) {
        const draftProductId = draft.selectedProductId ?? draft.selectedToiletProductId;
        const draftProduct = productCatalog.products.find((product) => product.id === draftProductId);
        if (draftProduct) {
          setProductQuantities({ [draftProduct.id]: 1 });
        }
      }
      if (draft.requestNote) setRequestNote(draft.requestNote);
    } catch {
      sessionStorage.removeItem(quoteDraftStorageKey(service.service_type_code));
    }
  }, [productCatalog, service.service_type_code]);

  useEffect(() => {
    const draft = { address, customer: { name: customerName, phone: customerPhone }, date, slot, productQuantities, requestNote };
    sessionStorage.setItem(quoteDraftStorageKey(service.service_type_code), JSON.stringify(draft));
  }, [address, customerName, customerPhone, date, productQuantities, requestNote, service.service_type_code, slot]);

  useEffect(() => {
    const normalized = normalizePhone(customerPhone);
    if (!/^010\d{8}$/.test(normalized)) {
      setPreviousOrders([]);
      return;
    }
    const controller = new AbortController();
    async function loadPreviousOrders() {
      setPreviousOrdersLoading(true);
      try {
        const response = await fetch(`/api/orders?phone=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        const json = await response.json();
        if (!response.ok || !json.ok) return;
        setPreviousOrders(json.data?.orders ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setPreviousOrders([]);
      } finally {
        setPreviousOrdersLoading(false);
      }
    }
    const timer = window.setTimeout(() => void loadPreviousOrders(), 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [customerPhone]);

  useEffect(() => {
    let ignore = false;
    async function loadSlots() {
      setSlotsLoading(true);
      setSlotsReady(false);
      setSlotsError("");
      try {
        const response = await fetch(`/api/slots?year=${calendarMonth.getFullYear()}&month=${calendarMonth.getMonth() + 1}`);
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(customerErrorMessage(json?.error, "예약 가능 시간을 불러오지 못했어요."));
        if (!ignore) {
          setSlotsByDate(json.data?.slots ?? {});
          setClosedSlotsByDate(json.data?.closed ?? {});
          setSlotDaysByDate(json.data?.days ?? {});
          setSlotsReady(true);
        }
      } catch {
        if (!ignore) {
          setSlotsByDate({});
          setClosedSlotsByDate({});
          setSlotDaysByDate({});
          setSlotsReady(false);
          setSlotsError("날짜를 불러올 수 없습니다. 다시 시도해주세요.");
        }
      } finally {
        if (!ignore) setSlotsLoading(false);
      }
    }
    void loadSlots();
    return () => {
      ignore = true;
    };
  }, [calendarMonth, slotsReloadKey]);

  useEffect(() => {
    const available = availableSlotsForDate(date);
    if (available.length > 0 && !available.includes(slot)) {
      setSlot(available[0]);
    }
  }, [date, slot, slotsByDate, slotsReady]);

  function handleAddressSelect(nextAddress: AddressSelection) {
    setAddress((current) => ({
      ...current,
      road_address: nextAddress.road_address,
      postal_code: nextAddress.postal_code
    }));
    setFieldErrors((current) => ({ ...current, address: "" }));
    void track(EVENT_TYPES.ADDRESS_ENTERED, { service_code: service.service_type_code });
  }

  function changeCalendarMonth(offset: number) {
    setSlotsByDate({});
    setClosedSlotsByDate({});
    setSlotDaysByDate({});
    setSlotsReady(false);
    setSlotsLoading(true);
    setSlotsError("");
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  async function requestJson(url: string, init: RequestInit) {
    const response = await fetch(url, init);
    const json = await response.json();
    if (!response.ok) {
      throw new Error(customerErrorMessage(json?.error, "요청을 다시 확인해주세요."));
    }
    return json.data;
  }

  async function uploadPhotos(orderId: string, accessToken: string) {
    for (const [index, file] of files.entries()) {
      const slot = customerPhotoSlot(index);
      const upload = await requestJson(`/api/orders/${orderId}/media/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || "image/jpeg", accessToken })
      });

      await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file
      });

      await requestJson(`/api/orders/${orderId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: upload.path, accessToken, angle: slot.angle, tags: [...slot.tags] })
      });
      void track(EVENT_TYPES.PHOTO_UPLOADED, { service_code: service.service_type_code, file_name: file.name, angle: slot.angle }, { orderId });
    }
  }

  async function createOrderAndQuote() {
    if (showProductCatalog && selectedProductItems.length === 0) {
      moveToProductSelection();
      throw new Error(`${productCatalog?.customConsultLabel ?? "제품"} 제품을 1개 이상 선택해주세요.`);
    }

    const nextErrors = basicInfoErrors();
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      focusFirstBasicInfoError(nextErrors);
      throw new Error(Object.values(nextErrors)[0]);
    }
    setFieldErrors({});
    if (!selectedScheduleReady) {
      const scheduleMessage = scheduleBlockMessage();
      moveToScheduleStep(scheduleMessage);
      throw new Error(scheduleMessage);
    }
    if (!service.standardizable) throw new Error("상담이 필요한 시공입니다. 카톡 상담으로 이어갈게요.");

    const rawPaymentDraft = sessionStorage.getItem(quotePaymentStorageKey(service.service_type_code));
    if (rawPaymentDraft) {
      try {
        const paymentDraft = JSON.parse(rawPaymentDraft) as PaymentReady & { fingerprint?: string; updatedAt?: number };
        const isFresh = paymentDraft.updatedAt ? Date.now() - paymentDraft.updatedAt < 60 * 60 * 1000 : false;
        if (isFresh && paymentDraft.fingerprint === orderFingerprint && typeof paymentDraft.paymentAmount === "number") {
          return paymentDraft;
        }
      } catch {
        sessionStorage.removeItem(quotePaymentStorageKey(service.service_type_code));
      }
    }

    const source = preset.source;
    const utm = getUtmParams();
    const orderItems = showProductCatalog
      ? selectedProductItems.map(({ product, qty }) => ({
          service_type_code: service.service_type_code,
          item_name: `${service.display_name} · ${product.model}`,
          qty,
          unit_price: serviceLaborPrice + (product.price ?? 0),
          options: [],
          metadata: { material_skus: materialSkus, product_grade: productGrade, ...replacementProductMetadata(product) }
        }))
      : [
          {
            service_type_code: service.service_type_code,
            item_name: service.display_name,
            qty: 1,
            unit_price: serviceLaborPrice,
            options: selectedAddonItems.map((addon) => ({ name: addon.name, price_delta: addon.retail_price })),
            metadata: { material_skus: materialSkus, product_grade: productGrade }
          }
        ];
    const quoteItems = showProductCatalog
      ? selectedProductItems.map(({ product, qty }) => ({
          service_type_code: service.service_type_code,
          item_name: `${service.display_name} · ${product.model}`,
          qty,
          unit_price: 0,
          metadata: { material_skus: materialSkus, product_grade: productGrade, ...replacementProductMetadata(product) }
        }))
      : [
          {
            service_type_code: service.service_type_code,
            item_name: service.display_name,
            qty: 1,
            unit_price: 0,
            metadata: { material_skus: materialSkus, product_grade: productGrade }
          }
        ];
    const orderSkus = showProductCatalog
      ? selectedProductItems.map(({ product, qty }) => ({
          sku: service.service_type_code,
          qty,
          service_type: "labor_service",
          product_grade: productGrade,
          material_skus: materialSkus,
          options: [],
          metadata: replacementProductMetadata(product)
        }))
      : [
          {
            sku: service.service_type_code,
            qty: 1,
            service_type: "labor_service",
            product_grade: productGrade,
            material_skus: materialSkus,
            options: selectedAddonItems.map((addon) => ({ name: addon.name, price_delta: addon.retail_price, sku: addon.sku }))
          }
        ];
    const order = await requestJson("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: {
          name: customerName.trim(),
          phone: normalizePhone(customerPhone),
          acquisition_source: preset.campaign ?? source,
          utm_source: utm.utm_source ?? source,
          utm_campaign: utm.utm_campaign ?? preset.campaign,
          utm_medium: utm.utm_medium,
          referrer_url: utm.referrer_url
        },
        utm_source: utm.utm_source ?? source,
        utm_campaign: utm.utm_campaign ?? preset.campaign,
        utm_medium: utm.utm_medium,
        referrer_url: utm.referrer_url,
        session_id: getSessionId(),
        landing_path: utm.landing_path ?? window.location.pathname,
        device_type: utm.device_type,
        region_code: preset.region,
        address,
        home: {
          address_full: `${address.road_address} ${address.detail_address}`.trim(),
          address_dong: preset.region ? regionLabel(preset.region) : "unknown",
          postal_code: address.postal_code
        },
        order: {
          channel: source,
          reason: "replace",
          urgency: "within_1w",
          self_diagnosis: service.photo_guide,
          skus: orderSkus
        },
        items: orderItems,
        visit_fee: quoteVisitFee,
        special_requests: requestNote.trim() || undefined
      })
    });

    const orderId = order.order.id as string;
    const accessToken = order.order.access_token as string;
    void track(EVENT_TYPES.ORDER_CREATED, { service_code: service.service_type_code }, { orderId, customerId: order.order.customer_id });
    if (files.length > 0) {
      await uploadPhotos(orderId, accessToken);
    }

    await requestJson(`/api/orders/${orderId}/reservation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reserved_date: date, time_slot: slot, status: "confirmed" })
    });

    const quote = await requestJson("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: orderId,
        items: quoteItems,
        visit_fee: quoteVisitFee,
        discount: 0
      })
    });
    await requestJson(`/api/quotes/${quote.quote.id}/accept`, { method: "POST" });
    void track(EVENT_TYPES.QUOTE_ACCEPTED, { service_code: service.service_type_code, total_final: quote.quote.total_final }, { orderId });

    const paymentReady = {
      orderId,
      accessToken,
      totalFinal: quote.quote.total_final as number,
      paymentAmount: showProductCatalog ? selectedProductPrice : quote.quote.total_final as number,
      onsiteAmount: showProductCatalog ? serviceLaborTotal : 0,
      orderName: showProductCatalog ? selectedProductSummaryText : service.display_name
    };

    sessionStorage.setItem(
      quotePaymentStorageKey(service.service_type_code),
      JSON.stringify({ ...paymentReady, fingerprint: orderFingerprint, updatedAt: Date.now() })
    );

    return paymentReady;
  }

  async function preparePayment(orderId: string): Promise<PreparedPayment> {
    const prepared = await requestJson("/api/payments/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId })
    }) as PreparedPayment;

    if (Number(prepared.amount) !== Number(prepared.productAmount)) {
      throw new Error("결제 금액 확인에 실패했어요. 제품값만 결제되도록 다시 시도해주세요.");
    }

    return prepared;
  }

  async function handlePayment() {
    setLoading(true);
    setMessage(mockPaymentMode ? "제품값 결제 정보를 준비하고 테스트 결제를 승인하고 있어요." : "제품값 결제 정보를 준비하고 토스 결제창을 열고 있어요.");
    try {
      const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!mockPaymentMode && !tossClientKey) {
        throw new Error("결제 모듈이 아직 준비되지 않았어요.");
      }

      const paymentReady = await createOrderAndQuote();
      const preparedPayment = await preparePayment(paymentReady.orderId);
      void track(
        EVENT_TYPES.PAYMENT_STARTED,
        {
          service_code: service.service_type_code,
          amount: preparedPayment.amount,
          product_amount: preparedPayment.productAmount,
          total_final: preparedPayment.totalAmount,
          onsite_amount: preparedPayment.onsitePaymentAmount,
          mock: mockPaymentMode,
          method: paymentMethod
        },
        { orderId: paymentReady.orderId }
      );

      if (mockPaymentMode) {
        const paymentKey = `mock-${preparedPayment.orderId}`;
        const response = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: preparedPayment.orderId,
            paymentKey,
            amount: preparedPayment.amount
          })
        });
        const json = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(customerErrorMessage(json?.error, "테스트 결제 승인에 실패했어요."));
        }

        sessionStorage.removeItem(quotePaymentStorageKey(service.service_type_code));

        const params = new URLSearchParams({
          paymentKey,
          orderId: preparedPayment.orderId,
          amount: String(preparedPayment.amount),
          accessToken: paymentReady.accessToken,
          serviceCode: service.service_type_code
        });
        window.location.assign(`/payment/success?${params.toString()}`);
        return;
      }

      await loadTossSdk();

      if (!window.TossPayments) {
        throw new Error("토스 결제 모듈을 불러오지 못했어요.");
      }

      if (!tossClientKey) {
        throw new Error("결제 모듈이 아직 준비되지 않았어요.");
      }

      const tossPayments = window.TossPayments(tossClientKey);
      const payment = tossPayments.payment({ customerKey: paymentReady.orderId });
      const origin = window.location.origin;
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || origin;
      const successParams = new URLSearchParams({
        accessToken: paymentReady.accessToken,
        serviceCode: service.service_type_code
      });
      const failParams = new URLSearchParams({
        serviceCode: service.service_type_code,
        internalOrderId: paymentReady.orderId
      });

      await payment.requestPayment({
        method: paymentMethod,
        amount: { currency: "KRW", value: preparedPayment.amount },
        orderId: preparedPayment.orderId,
        orderName: preparedPayment.orderName,
        customerName: customerName.trim(),
        customerMobilePhone: normalizePhone(customerPhone),
        successUrl: `${baseUrl}/payment/success?${successParams.toString()}`,
        failUrl: `${baseUrl}/payment/fail?${failParams.toString()}`,
        windowTarget: "self",
        ...(paymentMethod === "CARD" ? { card: { flowMode: "DEFAULT" as const } } : {})
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "결제에 실패했어요. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="quote-page">
      <style>{quoteCss}</style>
      {preset.banner && (
        <div className="context-banner">
          <MessageCircle size={18} />
          <span>{preset.banner}</span>
        </div>
      )}

      <section className="quote-hero">
        <div>
          <p>{categoryLabel(service.category)} · 예상 {service.estimated_minutes ?? 60}분</p>
          <h1>{service.display_name}</h1>
          <strong>{service.standardizable ? `시작가 ${won(displayedStartPrice)}` : "상담 후 견적 확정"}</strong>
        </div>
        {service.standardizable && (
          <div className="hero-price-breakdown" aria-label="시작가 구성">
            <div className="hero-breakdown-item">
              <span className="hero-breakdown-label">
                시공비
                <span className="hero-info-icon" role="img" aria-label={laborPriceHelp} title={laborPriceHelp}>
                  <Info size={17} aria-hidden="true" />
                </span>
              </span>
              <strong>{won(startLaborPrice)}</strong>
            </div>
            <b aria-hidden="true">+</b>
            <div className="hero-breakdown-item">
              <span className="hero-breakdown-label">
                제품 가격
                <span className="hero-info-icon" role="img" aria-label="선택 가능한 제품 중 최저 제품가 기준" title="선택 가능한 제품 중 최저 제품가 기준">
                  <Info size={17} aria-hidden="true" />
                </span>
              </span>
              <strong>{won(startProductPrice)}</strong>
            </div>
          </div>
        )}
      </section>

      {productCatalog && (
        <div ref={productSectionRef} className="product-selection-anchor">
          <ReplacementProductCatalog
            catalog={productCatalog}
            selectedQuantities={productQuantities}
            onProductReplace={replaceProduct}
            onQuantityChange={setProductQty}
            onQuantityDelta={changeProductQty}
          />
        </div>
      )}

      {productCatalog && (
        <section className="quote-section custom-product-consult">
          <div>
            <strong>원하시는 다른 {productCatalog.customConsultLabel} 제품이 있나요?</strong>
            <p>목록에 없는 제품은 브랜드와 품명을 카톡 상담으로 보내주세요. 설치 가능 여부와 제품가를 확인해서 안내드립니다.</p>
          </div>
          {kakaoChatUrl ? (
            <a href={kakaoChatUrl} target="_blank" rel="noreferrer">
              <MessageCircle size={20} />
              <span>카톡 상담</span>
            </a>
          ) : (
            <button type="button" disabled>
              <MessageCircle size={20} />
              <span>상담 준비 중</span>
            </button>
          )}
        </section>
      )}

      {!service.standardizable ? (
        <section className="quote-section counsel-section">
          <div className="section-title-row">
            <h2>작업 정보 입력</h2>
            <span>사진·주소 먼저</span>
          </div>
          <p className="data-guide-text">상담형 작업은 사진과 현장 조건을 확인한 뒤 견적과 일정을 안내합니다.</p>
          <button className={address.road_address ? "address-trigger filled" : "address-trigger"} type="button" onClick={() => setAddressModalOpen(true)}>
            <MapPin size={20} />
            <strong>{address.road_address || "주소 입력"}</strong>
            {address.postal_code && <small>우편번호 {address.postal_code}</small>}
          </button>
          <AddressModal open={addressModalOpen} onClose={() => setAddressModalOpen(false)} onSelect={handleAddressSelect} />
          <PhotoUploader files={files} guide={service.photo_guide ?? ""} onChange={setFiles} />
          <label className="field-label">
            요청사항
            <textarea value={requestNote} onChange={(event) => setRequestNote(event.target.value)} placeholder="예: 물이 잘 안 빠져요, 벽지가 들떴어요" rows={3} />
          </label>
          <div className="consult-next-note">
            <strong>견적 확정 후 일정 조율</strong>
            <p>상담에서 작업 범위가 정리되면 방문 가능 시간과 결제 안내를 이어서 드립니다.</p>
          </div>
          {kakaoChatUrl ? (
            <a className="primary-button" href={kakaoChatUrl} target="_blank" rel="noreferrer">
              사진으로 견적 요청하기
            </a>
          ) : (
            <div className="consult-fallback">
              <strong>상담 채널 준비 중</strong>
              <p>사진과 요청사항을 남겨두면 상담 채널이 열렸을 때 바로 견적 요청을 이어갈 수 있어요.</p>
              <button className="primary-button disabled" type="button" disabled>
                상담 채널 준비 중
              </button>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="quote-section quote-form-panel">
            <section className={`form-step-block ${activeFormStep === 0 ? "active" : ""} ${hasRequiredBasicInfo ? "completed" : ""}`} ref={addressSectionRef}>
              <div className="section-title-row step-title-row">
                <button type="button" className="step-title-button" onClick={() => setActiveFormStep(0)} aria-expanded={activeFormStep === 0}>
                <span>
                  <h2>1단계. 기본 정보</h2>
                  <small>연락처와 방문 주소</small>
                </span>
                </button>
              </div>
              <div className="form-step-body">
              <p className="data-guide-text">회원가입 없이 연락처와 방문 주소만 입력하면 기존 이용 이력과 예약 가능 여부를 확인합니다.</p>
              <div className="customer-field-grid">
                <label className="field-label">
                  <span>
                    이름 <span className="required-mark" aria-hidden="true">*</span>
                  </span>
                  <input
                    ref={nameInputRef}
                    className={fieldErrors.name ? "error" : ""}
                    value={customerName}
                    onChange={(event) => {
                      setCustomer((current) => ({ ...normalizeDraftCustomer(current), name: event.target.value }));
                      setFieldErrors((current) => ({ ...current, name: "" }));
                    }}
                    placeholder="이름"
                  />
                </label>
                <label className="field-label">
                  <span>
                    연락처 <span className="required-mark" aria-hidden="true">*</span>
                  </span>
                  <input
                    ref={phoneInputRef}
                    className={fieldErrors.phone ? "error" : ""}
                    value={customerPhone}
                    onChange={(event) => {
                      setCustomer((current) => ({ ...normalizeDraftCustomer(current), phone: event.target.value }));
                      setFieldErrors((current) => ({ ...current, phone: "" }));
                    }}
                    placeholder="010-XXXX-XXXX"
                  />
                </label>
              </div>
              {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
              {fieldErrors.phone && <p className="field-error">{fieldErrors.phone}</p>}
              <button ref={addressButtonRef} className={address.road_address ? "address-trigger filled" : fieldErrors.address ? "address-trigger error" : "address-trigger"} type="button" onClick={() => setAddressModalOpen(true)}>
                <MapPin size={20} />
                <strong>
                  {address.road_address || (
                    <>
                      주소 <span className="required-mark" aria-hidden="true">*</span>
                    </>
                  )}
                </strong>
                {address.postal_code && <small>우편번호 {address.postal_code}</small>}
              </button>
              {fieldErrors.address && <p className="field-error">{fieldErrors.address}</p>}
              <label className="field-label">
                <span>
                  상세주소 <span className="required-mark" aria-hidden="true">*</span>
                </span>
                <input
                  ref={detailAddressInputRef}
                  className={fieldErrors.detail_address ? "error" : ""}
                  value={address.detail_address}
                  onChange={(event) => {
                    setAddress((current) => ({ ...current, detail_address: event.target.value }));
                    setFieldErrors((current) => ({ ...current, detail_address: "" }));
                  }}
                  placeholder="예: 101동 1203호, 단독주택 2층"
                />
                <small className="field-help">동/호수 또는 층 정보를 입력해야 방문이 가능합니다.</small>
              </label>
              {fieldErrors.detail_address && <p className="field-error">{fieldErrors.detail_address}</p>}
              <AddressModal open={addressModalOpen} onClose={() => setAddressModalOpen(false)} onSelect={handleAddressSelect} />
              {previousOrdersLoading && <p className="returning-note">이전 시공 이력을 확인하고 있어요.</p>}
              {previousOrders.length > 0 && <PreviousOrderCard order={previousOrders[0]} />}
              </div>
            </section>

          <section ref={scheduleSectionRef} className={`form-step-block ${activeFormStep === 1 ? "active" : ""} ${selectedScheduleReady ? "completed" : ""}`}>
            <div className="section-title-row step-title-row">
              <button type="button" className="step-title-button" onClick={() => setActiveFormStep(1)} aria-expanded={activeFormStep === 1}>
                <span>
                  <h2>
                    2단계. 일정/확인 <span className="required-mark" aria-hidden="true">*</span>
                  </h2>
                  <small>
                {slotsError ? (
                  "다시 확인 필요"
                ) : slotsLoading ? (
                  "예약 가능 시간 확인 중"
                ) : (
                  "예약일 선택"
                )}
                  </small>
                </span>
              </button>
            </div>
            <div className="form-step-body">
            <p className="data-guide-text">제품과 일정 준비 기간 때문에 예약은 오늘 기준 3일 이후 날짜부터 가능합니다. 희망 날짜와 시간대를 선택해주세요.</p>
            <div className="calendar-panel">
              <div className="calendar-header">
                <button type="button" onClick={() => changeCalendarMonth(-1)} aria-label="이전 달">
                  &lt;
                </button>
                <strong>{monthLabel(calendarMonth)}</strong>
                <button type="button" onClick={() => changeCalendarMonth(1)} aria-label="다음 달">
                  &gt;
                </button>
              </div>
              <div className="calendar-weekdays">
                {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {calendarDays.map((day) => {
                  const iso = toIsoDate(day);
                  const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                  const isToday = iso === todayIso;
                  const isSelected = iso === date;
                  const slotDay = slotDaysByDate[iso];
                  const availableSlots = availableSlotsForDate(iso);
                  const partiallyBooked = Boolean(slotDay?.hasReservation && availableSlots.length > 0 && !slotDay?.allFull);
                  const disabled = slotsLoading || !slotsReady || Boolean(slotDay?.beforeMinDate || slotDay?.blocked || slotDay?.allFull) || iso < minSelectableDate || availableSlots.length === 0;
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={disabled}
                      className={[
                        isCurrentMonth ? "" : "outside",
                        isToday ? "today" : "",
                        isSelected ? "selected" : "",
                        slotDay?.allFull ? "all-full" : "",
                        slotDay?.blocked ? "blocked" : "",
                        partiallyBooked ? "partially-booked" : "",
                        disabled ? "disabled" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => {
                        setDate(iso);
                        const nextSlot = availableSlots.includes(slot) ? slot : availableSlots[0] ?? "morning";
                        setSlot(nextSlot);
                        void track(EVENT_TYPES.DATE_SELECTED, { service_code: service.service_type_code, date: iso, slot: nextSlot });
                      }}
                    >
                      <span>{day.getDate()}</span>
                      {partiallyBooked ? <small>일부마감</small> : slotDay?.allFull ? <i aria-hidden="true">•</i> : null}
                    </button>
                  );
                })}
              </div>
              {slotsLoading && (
                <div className="slot-skeleton-grid" aria-label="예약 가능 시간 확인 중">
                  {Array.from({ length: 2 }, (_, index) => (
                    <span key={index} />
                  ))}
                </div>
              )}
              {slotsError && (
                <div className="slot-error" role="alert">
                  <p>{slotsError}</p>
                  <button type="button" onClick={() => setSlotsReloadKey((current) => current + 1)}>
                    다시 시도
                  </button>
                </div>
              )}
              {slotsReady && !slotsError && selectableDatesInMonth === 0 && (
                <p className="slot-help strong">이번 달 예약 가능한 날짜가 없습니다. 다음 달을 확인해주세요.</p>
              )}
            </div>
            <div className="slot-grid slide-down">
              {(["morning", "afternoon"] as SlotPeriod[]).map((period) => {
                const slotDetail = slotDaysByDate[date]?.slots?.[period];
                const disabled = slotsLoading || !slotsReady || Boolean(slotDetail?.isFull) || !availableSlotsForDate(date).includes(period);
                return (
              <button
                key={period}
                className={[slot === period ? "selected" : "", disabled ? "disabled" : ""].filter(Boolean).join(" ")}
                type="button"
                disabled={disabled}
                onClick={() => { setSlot(period); void track(EVENT_TYPES.DATE_SELECTED, { service_code: service.service_type_code, date, slot: period }); }}
              >
                {period === "morning" ? (
                  <>
                <span>오전</span>
                <strong>09:00-12:00</strong>
                  </>
                ) : (
                  <>
                <span>오후</span>
                <strong>13:00-17:00</strong>
                  </>
                )}
                {slotDetail && <b>{slotDetail.usedCount}/{slotDetail.maxCount}</b>}
                {disabled ? <small>{slotsLoading || !slotsReady ? "확인 중" : "마감"}</small> : slot === period ? <em>✓</em> : null}
              </button>
                );
              })}
            </div>
            {slotDaysByDate[date]?.hasReservation ? (
              <p className="slot-help strong">예약이 있는 시간대는 마감으로 표시됩니다. 가능한 시간대를 선택해주세요.</p>
            ) : closedSlotsByDate[date]?.length ? (
              <p className="slot-help">마감된 시간대는 회색으로 표시됩니다.</p>
            ) : null}
            <details className="quote-optional-details compact request-note-field">
              <summary>
                <strong>사진/요청사항</strong>
                <span>{files.length > 0 ? `사진 ${files.length}장 첨부됨` : "선택 입력"}</span>
              </summary>
              <div className="optional-detail-body">
                <label className="field-label">
                  요청사항
                  <textarea value={requestNote} onChange={(event) => setRequestNote(event.target.value)} placeholder="예: 기존 제품 철거 필요, 주차가 어려워요" rows={3} />
                </label>
                <PhotoUploader files={files} guide={service.photo_guide ?? ""} onChange={setFiles} />
              </div>
            </details>
            </div>
          </section>
          </section>

          <QuoteStickySummary
            total={displayTotal}
            serviceName={service.display_name}
            date={date}
            slot={slot}
            photoCount={files.length}
            message={message}
            paymentAvailable={paymentAvailable}
            mockPaymentMode={mockPaymentMode}
            loading={loading}
            onPayment={() => handlePayment()}
            onPaymentBlocked={handlePaymentBlocked}
            selectionReady={productSelectionReady}
            selectionMessage={`${productCatalog?.customConsultLabel ?? "제품"} 제품을 먼저 선택해주세요.`}
            mobileSummaryLabel={mobileSummaryLabel}
            summaryTitle={showProductCatalog ? "오늘 결제할 금액" : "결제 요약"}
            paymentButtonLabel={showProductCatalog && productSelectionReady ? `제품값 ${won(onlinePaymentTotal)} 결제하기` : `${displayTotal} 결제하기`}
            paymentReadyMessage={showProductCatalog ? "제품값만 먼저 결제합니다. 시공비는 시공 완료 후 현장에서 결제합니다." : "결제 후 방문 일정이 확정됩니다."}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            productSelection={
              showProductCatalog ? (
                <div className="sticky-selected-products" aria-label="선택 제품 요약">
                  <div className="sticky-selected-products-title">
                    <span>선택 제품</span>
                    <strong>{selectedProductItems.length > 0 ? `총 ${totalProductQty}개` : "선택 전"}</strong>
                  </div>
                  <div className={selectedProductItems.length > 0 ? "sticky-selected-product-summary" : "sticky-selected-product-summary empty"}>
                    <strong>{selectedProductBrief}</strong>
                    <small>{selectedProductMeta}</small>
                  </div>
                  {selectedProductItems.length > 0 && (
                    <div className="sticky-payment-breakdown" aria-label="결제 금액 구분">
                      <div>
                        <span>시공비 현장결제</span>
                        <strong>{won(onsitePaymentTotal)}</strong>
                      </div>
                      <div>
                        <span>예상 총액</span>
                        <strong>{won(total)}</strong>
                      </div>
                    </div>
                  )}
                </div>
              ) : null
            }
          />
        </>
      )}
    </main>
  );
}

function ReplacementProductCatalog({
  catalog,
  selectedQuantities,
  onProductReplace,
  onQuantityChange,
  onQuantityDelta
}: {
  catalog: NonNullable<ReturnType<typeof getReplacementProductCatalog>>;
  selectedQuantities: Record<string, number>;
  onProductReplace: (productId: string) => void;
  onQuantityChange: (productId: string, qty: number) => void;
  onQuantityDelta: (productId: string, delta: number) => void;
}) {
  const totalCount = catalog.groups.reduce((sum, group) => sum + group.count, 0);
  const selectedProductCount = Object.values(selectedQuantities).filter((qty) => qty > 0).length;
  const [productScope, setProductScope] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState<ProductPriceFilterId>("all");
  const [previewProduct, setPreviewProduct] = useState<ReplacementProduct | null>(null);
  const brandOptions = useMemo(() => sortedBrandOptions(catalog.products), [catalog.products]);
  const recommendedProducts = useMemo(
    () =>
      catalog.products
        .filter((product) => product.isRecommended || product.recommendLabel)
        .sort((a, b) => recommendationSortValue(a) - recommendationSortValue(b))
        .slice(0, 3),
    [catalog.products]
  );
  const filteredRecommendedProducts = recommendedProducts.filter((product) => matchesProductFilters(product, brandFilter, priceFilter));
  const groupViews = catalog.groups.map((group) => {
    const products = group.products.filter((product) => matchesProductFilters(product, brandFilter, priceFilter)).sort(productDisplaySort);
    const prices = products.map((product) => product.price).filter((price): price is number => typeof price === "number");
    return {
      ...group,
      products,
      filteredCount: products.length,
      filteredMinPrice: prices.length > 0 ? Math.min(...prices) : null
    };
  });
  const filteredTotalCount = groupViews.reduce((sum, group) => sum + group.filteredCount, 0);
  const activeGroupView = groupViews.find((group) => group.id === productScope);
  const scopedProducts =
    productScope === "recommended"
      ? filteredRecommendedProducts
      : productScope === "all"
        ? groupViews.flatMap((group) => group.products).sort(productDisplaySort)
        : activeGroupView?.products ?? [];
  const scopedTitle =
    productScope === "recommended"
      ? "추천 제품"
      : productScope === "all"
        ? "전체 제품"
        : activeGroupView?.name ?? "제품 목록";
  const scopedDescription =
    productScope === "recommended"
      ? "빠르게 고르기 좋은 대표 제품입니다."
      : productScope === "all"
        ? "브랜드와 가격대 필터로 좁혀서 가격 낮은 순서로 비교할 수 있습니다."
        : activeGroupView?.summary ?? "선택한 조건에 맞는 제품입니다.";

  function scrollToProductSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectProductScope(scope: string) {
    setProductScope(scope);
    window.requestAnimationFrame(() => scrollToProductSection("product-results"));
  }

  useEffect(() => {
    setProductScope("all");
    setBrandFilter("all");
    setPriceFilter("all");
  }, [catalog.serviceCode]);

  useEffect(() => {
    if (!previewProduct) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPreviewProduct(null);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewProduct]);

  return (
    <section className="quote-section toilet-product-catalog" id="product-catalog-top">
      <div className="section-title-row">
        <h2>{catalog.title}</h2>
        <span>제품 {totalCount}개</span>
      </div>
      <p className="data-guide-text">{catalog.sourceNote}</p>

      <div className="product-index-chips" aria-label={`${catalog.customConsultLabel} 제품 목차`}>
        <button type="button" className={productScope === "all" ? "active" : ""} onClick={() => selectProductScope("all")}>
          전체
        </button>
        <button type="button" className={productScope === "recommended" ? "active" : ""} onClick={() => selectProductScope("recommended")}>
          추천
        </button>
        {catalog.groups.map((group) => (
          <button key={group.id} type="button" className={productScope === group.id ? "active" : ""} onClick={() => selectProductScope(group.id)}>
            {group.name}
          </button>
        ))}
      </div>

      <div className="toilet-filter-row" aria-label={`${catalog.customConsultLabel} 제품 필터`}>
        <div className="filter-chip-group" aria-label="브랜드 필터">
          <span>브랜드</span>
          <div className="filter-chip-scroll">
            <button type="button" className={brandFilter === "all" ? "active" : ""} onClick={() => setBrandFilter("all")}>
              전체
            </button>
            {brandOptions.map((brand) => (
              <button key={brand} type="button" className={brandFilter === brand ? "active" : ""} onClick={() => setBrandFilter(brand)}>
                {brand}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-chip-group" aria-label="가격대 필터">
          <span>가격대</span>
          <div className="filter-chip-scroll">
            {PRODUCT_PRICE_FILTERS.map((filter) => (
              <button key={filter.id} type="button" className={priceFilter === filter.id ? "active" : ""} onClick={() => setPriceFilter(filter.id)}>
                {filter.label.replace("전체 가격대", "전체")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredTotalCount === 0 && <div className="toilet-filter-empty">조건에 맞는 제품이 없습니다. 브랜드나 가격대를 다시 선택해주세요.</div>}

      {productScope === "all" && filteredRecommendedProducts.length > 0 && (
        <section className="recommended-products" id="product-recommendations" aria-label="추천 제품">
          <div className="product-subsection-title">
            <strong>추천 제품</strong>
            <span>사진 확인 전 빠르게 비교하기 좋은 3가지 선택지</span>
          </div>
          <div className="recommended-product-grid">
            {filteredRecommendedProducts.map((product) => (
              <ReplacementProductCard
                key={product.id}
                product={product}
                qty={selectedQuantities[product.id] ?? 0}
                selectedProductCount={selectedProductCount}
                recommended
                onProductReplace={onProductReplace}
                onQuantityChange={onQuantityChange}
                onQuantityDelta={onQuantityDelta}
                onImagePreview={setPreviewProduct}
              />
            ))}
          </div>
        </section>
      )}

      <section className="product-results" id="product-results" aria-label={`${catalog.customConsultLabel} 제품 목록`}>
        <div className="product-subsection-title">
          <strong>{scopedTitle}</strong>
          <span>{scopedDescription}</span>
        </div>
        {scopedProducts.length === 0 ? (
          <div className="toilet-filter-empty">조건에 맞는 제품이 없습니다. 다른 브랜드나 가격대를 선택해주세요.</div>
        ) : (
          <div className={productScope === "recommended" ? "recommended-product-grid" : "toilet-product-grid all-product-list"}>
            {scopedProducts.map((product) => (
              <ReplacementProductCard
                key={product.id}
                product={product}
                qty={selectedQuantities[product.id] ?? 0}
                selectedProductCount={selectedProductCount}
                recommended={productScope === "recommended"}
                onProductReplace={onProductReplace}
                onQuantityChange={onQuantityChange}
                onQuantityDelta={onQuantityDelta}
                onImagePreview={setPreviewProduct}
              />
            ))}
          </div>
        )}
      </section>

      {previewProduct?.image && (
        <div className="product-image-modal" role="presentation" onClick={() => setPreviewProduct(null)}>
          <div className="product-image-dialog" role="dialog" aria-modal="true" aria-label={`${previewProduct.brand} ${previewProduct.model} 제품 사진`} onClick={(event) => event.stopPropagation()}>
            <div className="product-image-modal-head">
              <div>
                <span>{previewProduct.brand}</span>
                <strong>{previewProduct.model}</strong>
                <small>품번 {previewProduct.sku.trim() || "-"}</small>
              </div>
              <button type="button" onClick={() => setPreviewProduct(null)} aria-label="제품 사진 크게 보기 닫기">
                닫기
              </button>
            </div>
            <div className="product-image-modal-frame">
              <img src={previewProduct.image} alt={`${previewProduct.brand} ${previewProduct.model}`} />
            </div>
            <div className="product-image-modal-meta">
              <strong>{typeof previewProduct.price === "number" ? won(previewProduct.price) : "가격 확인 필요"}</strong>
              <p>{previewProduct.note}</p>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}

function ReplacementProductCard({
  product,
  qty,
  selectedProductCount,
  recommended = false,
  onProductReplace,
  onQuantityChange,
  onQuantityDelta,
  onImagePreview
}: {
  product: ReplacementProduct;
  qty: number;
  selectedProductCount: number;
  recommended?: boolean;
  onProductReplace: (productId: string) => void;
  onQuantityChange: (productId: string, qty: number) => void;
  onQuantityDelta: (productId: string, delta: number) => void;
  onImagePreview: (product: ReplacementProduct) => void;
}) {
  const selected = qty > 0;
  const priceAvailable = typeof product.price === "number";
  const skuLabel = product.sku.trim() || "-";
  const noteText = compactProductNote(product.note);

  return (
    <article className={[selected ? "toilet-product-card selected" : "toilet-product-card", recommended ? "recommended" : ""].filter(Boolean).join(" ")}>
      {product.image ? (
        <button type="button" className="toilet-product-image toilet-product-image-button" onClick={() => onImagePreview(product)} aria-label={`${product.brand} ${product.model} 사진 크게 보기`}>
          <img src={product.image} alt={`${product.brand} ${product.model}`} loading="lazy" />
          <span className="image-zoom-hint">크게 보기</span>
        </button>
      ) : (
        <div className="toilet-product-image empty">
          <span>이미지 확인 필요</span>
        </div>
      )}
      <div className="toilet-product-body">
        <div className="toilet-product-meta">
          <span>{product.brand}</span>
          {product.recommendLabel && <b className="recommend-badge">{product.recommendLabel}</b>}
          {selected && <b className="selected-badge">선택됨</b>}
        </div>
        <h3>{product.model}</h3>
        <p className="toilet-product-sku">품번 {skuLabel}</p>
        <strong className="toilet-product-price">{priceAvailable ? won(product.price ?? 0) : "가격 확인 필요"}</strong>
        {!recommended && (
          <p className="toilet-product-note compact" title={product.note}>
            {noteText}
          </p>
        )}
        <div className="toilet-card-actions">
          {selected ? (
            <>
              {selectedProductCount > 1 && (
                <button type="button" className="toilet-replace-button" onClick={() => onProductReplace(product.id)}>
                  이 제품만 선택
                </button>
              )}
              <div className="quantity-control" aria-label={`${product.model} 수량`}>
                <button type="button" onClick={() => onQuantityDelta(product.id, -1)} aria-label={`${product.model} 수량 줄이기`}>
                  -
                </button>
                <span>{qty}</span>
                <button type="button" onClick={() => onQuantityDelta(product.id, 1)} aria-label={`${product.model} 수량 늘리기`}>
                  +
                </button>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="toilet-replace-button primary" disabled={!priceAvailable} onClick={() => onProductReplace(product.id)}>
                {priceAvailable ? "이 제품 선택" : "상담 필요"}
              </button>
              {!recommended && priceAvailable && (
                <button type="button" className="toilet-add-button" onClick={() => onQuantityChange(product.id, 1)}>
                  같이 선택
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function PreviousOrderCard({ order }: { order: PreviousOrder }) {
  const serviceCode = order.service_type_code ?? order.skus?.[0]?.sku ?? order.skus?.[0]?.service_type_code ?? "";
  const job = order.jobs?.[0];
  return (
    <div className="returning-card">
      <strong>이전에 저희를 이용하셨군요!</strong>
      <p>
      {formatKRDate(job?.completed_at ?? order.created_at)} {formatServiceName(serviceCode)} {job?.status === "inspected" || order.status === "done" ? "완료" : "진행 이력"}
      </p>
      {job?.assigned_technician_name && <span>담당 기사: {job.assigned_technician_name}</span>}
      <small>이전 주문 상세는 주문 완료 시 받은 전용 링크에서 확인할 수 있어요.</small>
    </div>
  );
}

const quoteCss = `
  .quote-page {
    position: relative;
    min-height: 100vh;
    background: var(--color-bg);
    color: var(--color-text);
    padding: 18px 18px 120px;
    font-family: var(--font-body);
    word-break: keep-all;
    line-break: strict;
    overflow-wrap: break-word;
  }
  .quote-page :where(h1, h2, h3, p, span, small, strong, label, summary, button, a) {
    word-break: keep-all;
    line-break: strict;
  }
  .quote-page :where(p, small, label) {
    text-wrap: pretty;
  }
  .context-banner {
    max-width: 980px;
    margin: 0 auto 12px;
    background: var(--color-charcoal-panel);
    color: var(--color-cream);
    border-radius: 8px;
    padding: 14px 16px;
    font-weight: 600;
  }
  .quote-hero,
  .quote-flow-note,
  .quote-scope-cards,
  .quote-section {
    max-width: 980px;
    margin: 0 auto 14px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 18px;
  }
  .quote-hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }
  .hero-price-breakdown {
    min-width: min(420px, 48%);
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 18px;
    border-radius: 8px;
    padding: 16px 18px;
    background: #f5f6f8;
    color: #2a2c30;
  }
  .hero-breakdown-item {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .hero-breakdown-label {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: #555961;
    font-size: var(--text-label);
    line-height: var(--leading-label);
    font-weight: 700;
    white-space: nowrap;
  }
  .hero-info-icon {
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
  }
  .hero-info-icon svg {
    flex: 0 0 auto;
    color: #7d8796;
    stroke-width: 2.6;
  }
  .hero-breakdown-item strong {
    font-size: var(--text-price-sub);
    line-height: var(--leading-price-sub);
    font-weight: 700;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .hero-price-breakdown b {
    color: #22252a;
    font-size: var(--text-price-main);
    line-height: var(--leading-price-main);
    font-weight: 700;
    letter-spacing: -0.015em;
    font-variant-numeric: tabular-nums;
  }
  .quote-flow-note {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 18px;
    align-items: center;
    padding: 14px 16px;
  }
  .quote-flow-note span {
    color: var(--color-text-muted);
    font-size: var(--text-label);
    line-height: var(--leading-label);
    font-weight: 600;
  }
  .quote-flow-note strong {
    display: block;
    margin-top: 4px;
    font-size: var(--text-h3);
    line-height: var(--leading-h3);
    font-weight: 700;
    letter-spacing: -0.012em;
  }
  .quote-flow-note p {
    margin: 4px 0 0;
    color: var(--color-text-muted);
    line-height: 1.5;
  }
  .quote-flow-note small,
  .quote-flow-note em {
    display: block;
    margin-top: 6px;
    color: var(--color-text-muted);
    line-height: 1.5;
  }
  .quote-flow-note em {
    color: var(--color-primary);
    font-style: normal;
    font-weight: 600;
  }
  .quote-flow-note ol {
    display: grid;
    grid-template-columns: repeat(4, minmax(72px, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .quote-flow-note li {
    min-height: 56px;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 3px;
    border-radius: 8px;
    background: var(--color-sage-soft);
    color: var(--color-text-muted);
    font-size: var(--text-label);
    line-height: var(--leading-label);
    font-weight: 600;
  }
  .quote-flow-note li.current {
    outline: 1px solid var(--color-sage);
    background: var(--color-sage-soft);
    color: var(--color-primary);
  }
  .quote-flow-note li.done {
    background: var(--color-primary);
    color: #fffaf1;
  }
  .quote-flow-note b {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: var(--color-charcoal-panel);
    color: var(--color-cream);
    font-size: 12px;
  }
  .quote-flow-note li.done b {
    background: var(--color-surface);
    color: var(--color-primary);
  }
  .quote-scope-cards {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    border: 0;
    padding: 0;
    background: transparent;
  }
  .quote-scope-cards article {
    display: grid;
    gap: 6px;
    min-height: 104px;
    border: 1px solid #dde2d7;
    border-radius: 8px;
    padding: 12px;
    background: #fff;
  }
  .quote-scope-cards span {
    width: fit-content;
    border-radius: 999px;
    padding: 3px 9px;
    background: var(--color-primary-highlight);
    color: var(--color-primary);
    font-size: 12px;
    font-weight: 700;
  }
  .quote-scope-cards strong {
    line-height: 1.3;
    font-size: var(--text-body-sm);
  }
  .quote-scope-cards p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-body-sm);
    line-height: var(--leading-body-sm);
  }
  .quote-hero p,
  .muted,
  .guide-text,
  .sticky-cta p {
    color: var(--color-text-muted);
    margin: 0;
    line-height: var(--leading-body);
  }
  .quote-hero h1 {
    margin: 8px 0;
    font-size: var(--text-h1);
    line-height: var(--leading-h1);
    font-weight: 700;
    letter-spacing: -0.02em;
    overflow-wrap: break-word;
  }
  .quote-hero strong,
  .price-total strong {
    font-size: var(--text-price-sub);
    line-height: var(--leading-price-sub);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .hero-badge {
    background: var(--color-gold);
    color: #211c12;
    border-radius: 999px;
    padding: 9px 12px;
    font-size: var(--text-label);
    line-height: var(--leading-label);
    font-weight: 600;
    white-space: nowrap;
  }
  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }
  .quote-section {
    transition: box-shadow 160ms ease, transform 160ms ease;
  }
  .quote-section:focus-within {
    box-shadow: 0 0 0 3px rgba(184, 138, 43, 0.16), var(--shadow-sm);
  }
  .section-title-row h2 {
    margin: 0;
    font-size: var(--text-h3);
    line-height: var(--leading-h3);
    font-weight: 700;
    letter-spacing: -0.012em;
  }
  .section-title-row span {
    color: var(--color-text-muted);
    font-size: var(--text-label);
    line-height: var(--leading-label);
    font-weight: 600;
    text-align: right;
  }
  .section-title-row .success-label {
    color: var(--color-primary);
    font-weight: 700;
  }
  .field-label {
    display: grid;
    gap: 8px;
    color: var(--color-text);
    font-weight: 700;
  }
  .field-label > span {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
  }
  .product-selection-anchor {
    scroll-margin-top: 78px;
  }
  .field-help {
    color: var(--color-text-muted);
    font-size: var(--text-caption);
    line-height: var(--leading-caption);
    font-weight: 400;
  }
  .required-mark {
    color: #dc2626;
    font-weight: 700;
  }
  .customer-field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .field-label textarea {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 12px;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    resize: vertical;
  }
  .consult-next-note {
    display: grid;
    gap: 4px;
    border-top: 1px solid var(--color-border);
    padding-top: 12px;
  }
  .consult-next-note strong {
    color: var(--color-primary);
    font-size: var(--text-sm);
  }
  .consult-next-note p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: 1.5;
  }
  .consult-fallback {
    display: grid;
    gap: 8px;
    border-top: 1px solid var(--color-border);
    padding-top: 12px;
  }
  .consult-fallback strong {
    color: var(--color-text);
    font-size: var(--text-sm);
  }
  .consult-fallback p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: 1.5;
  }
  .quote-optional-details {
    display: block;
  }
  .quote-optional-details summary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px 12px;
    align-items: center;
    cursor: pointer;
    list-style: none;
  }
  .quote-optional-details summary::-webkit-details-marker {
    display: none;
  }
  .quote-optional-details summary::after {
    content: "펼치기";
    border-radius: var(--radius-full);
    padding: 6px 10px;
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 700;
  }
  .quote-optional-details[open] summary::after {
    content: "접기";
  }
  .quote-optional-details summary strong {
    font-size: var(--text-lg);
    line-height: 1.25;
  }
  .quote-optional-details summary span {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
  .quote-optional-details.compact {
    margin-top: 2px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
    padding: var(--space-4);
  }
  .quote-optional-details.compact summary strong {
    font-size: var(--text-base);
  }
  .quote-optional-details.compact .optional-detail-body {
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-4);
  }
  .optional-detail-body {
    display: grid;
    gap: var(--space-4);
    margin-top: var(--space-4);
  }
  .embedded-section {
    display: grid;
    gap: var(--space-3);
  }
  .grade-grid,
  .slot-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .grade-grid button,
  .slot-grid button,
  .addon-row,
  .upload-box,
  .primary-button,
  .sticky-cta button {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    border-radius: 8px;
    padding: 14px;
    min-height: 56px;
  }
  .grade-grid button,
  .slot-grid button,
  .sticky-cta button,
  .text-button,
  .primary-button {
    cursor: pointer;
    font-weight: 700;
  }
  .grade-grid button {
    display: grid;
    gap: 6px;
    text-align: left;
  }
  .grade-grid button.selected,
  .slot-grid button.selected {
    border-color: var(--color-sage);
    background: var(--color-sage-soft);
  }
  .selected-address {
    display: grid;
    gap: 6px;
    min-height: 74px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 14px;
    background: var(--color-sage-soft);
  }
  .selected-address span,
  .selected-address small {
    color: var(--color-text-muted);
  }
  .address-trigger.error,
  input.error {
    border-color: #dc2626;
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12);
  }
  .field-error {
    margin: 8px 0 0;
    color: #dc2626;
    font-size: var(--text-xs);
    font-weight: 600;
  }
  .data-guide-text {
    margin: -4px 0 16px;
    color: var(--color-text-muted);
    max-width: 680px;
    font-size: var(--text-body-sm);
    line-height: var(--leading-body-sm);
  }
  .toilet-product-catalog {
    display: grid;
    gap: 16px;
    scroll-margin-top: 78px;
  }
  .toilet-product-catalog .data-guide-text {
    margin: -6px 0 0;
  }
  .product-index-chips {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 2px 0 8px;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .product-index-chips::-webkit-scrollbar,
  .filter-chip-scroll::-webkit-scrollbar {
    display: none;
  }
  .product-index-chips button,
  .filter-chip-group button {
    min-height: 34px;
    flex: 0 0 auto;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 0 13px;
    background: rgba(255, 250, 241, 0.78);
    color: var(--color-text);
    font: inherit;
    font-size: var(--text-xs);
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }
  .product-index-chips button:hover,
  .product-index-chips button.active,
  .filter-chip-group button:hover,
  .filter-chip-group button.active {
    border-color: var(--color-sage);
    background: var(--color-sage-soft);
    color: var(--color-primary);
  }
  .product-subsection-title {
    display: grid;
    gap: 4px;
  }
  .product-subsection-title strong {
    font-size: var(--text-h3);
    line-height: var(--leading-h3);
    font-weight: 700;
    letter-spacing: -0.012em;
  }
  .product-subsection-title span {
    color: var(--color-text-muted);
    max-width: 640px;
    font-size: var(--text-body-sm);
    line-height: var(--leading-body-sm);
  }
  .recommended-products {
    display: grid;
    gap: 12px;
    scroll-margin-top: 78px;
  }
  .product-results {
    display: grid;
    gap: 12px;
    scroll-margin-top: 78px;
  }
  .recommended-product-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .toilet-product-meta span {
    color: var(--color-primary);
    font-size: var(--text-xs);
    font-weight: 700;
  }
  .toilet-filter-row {
    display: grid;
    gap: 10px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 12px;
    background: rgba(255, 250, 241, 0.74);
  }
  .filter-chip-group {
    display: grid;
    grid-template-columns: 46px minmax(0, 1fr);
    gap: 7px 8px;
    align-items: center;
  }
  .filter-chip-group > span {
    color: var(--color-text-muted);
    font-size: var(--text-caption);
    line-height: var(--leading-caption);
    font-weight: 700;
  }
  .filter-chip-scroll {
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    align-items: center;
    scrollbar-width: none;
  }
  .toilet-filter-empty {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 18px;
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.5;
    text-align: center;
  }
  .custom-product-consult {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
  }
  .custom-product-consult strong {
    display: block;
    margin-bottom: 6px;
    font-size: var(--text-lg);
  }
  .custom-product-consult p {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.55;
  }
  .custom-product-consult a,
  .custom-product-consult button {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid rgba(34, 33, 29, 0.92);
    border-radius: 8px;
    padding: 0 16px;
    background: rgba(34, 33, 29, 0.92);
    color: var(--color-cream);
    font: inherit;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
  }
  .custom-product-consult button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .toilet-product-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .toilet-product-card {
    width: 100%;
    min-width: 0;
    appearance: none;
    display: grid;
    grid-template-columns: 132px minmax(0, 1fr);
    min-height: 168px;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: #fff;
    color: var(--color-text);
    font: inherit;
    text-align: left;
    cursor: default;
    transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
  }
  .toilet-product-card:hover {
    border-color: var(--color-sage);
    box-shadow: var(--shadow-sm);
    transform: translateY(-1px);
  }
  .toilet-product-card:focus-visible {
    outline: 3px solid rgba(184, 138, 43, 0.22);
    outline-offset: 2px;
  }
  .toilet-product-card.selected {
    border-color: var(--color-primary);
    background: var(--color-sage-soft);
    box-shadow: inset 0 0 0 2px rgba(184, 138, 43, 0.22), var(--shadow-sm);
  }
  .recommended-product-grid .toilet-product-card {
    grid-template-columns: 1fr;
    min-height: 0;
  }
  .toilet-product-grid .toilet-product-card {
    grid-template-columns: 1fr;
    min-height: 0;
  }
  .recommended-product-grid .toilet-product-image {
    height: 128px;
    min-height: 128px;
    border-right: 0;
    border-bottom: 1px solid #f0ece3;
    background: #fff;
  }
  .toilet-product-grid .toilet-product-image {
    height: 128px;
    min-height: 128px;
    border-bottom: 1px solid #f0ece3;
    background: #fff;
  }
  .recommended-product-grid .toilet-product-body {
    grid-template-rows: none;
    align-content: center;
    gap: 5px;
    border-left: 0;
    padding: 10px 11px 11px;
  }
  .toilet-product-grid .toilet-product-body {
    border-left: 0;
    gap: 5px;
    padding: 10px 11px 11px;
  }
  .toilet-product-card.recommended {
    background: linear-gradient(180deg, #fff, rgba(255, 250, 241, 0.88));
  }
  .toilet-product-image {
    display: grid;
    place-items: center;
    min-height: 168px;
    overflow: hidden;
    background: #fff;
  }
  .toilet-product-image-button {
    position: relative;
    width: 100%;
    border: 0;
    padding: 0;
    color: inherit;
    font: inherit;
    cursor: zoom-in;
  }
  .toilet-product-image-button:focus-visible {
    outline: 3px solid rgba(184, 138, 43, 0.24);
    outline-offset: -3px;
  }
  .toilet-product-image img {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    object-fit: contain;
    display: block;
    padding: 5px;
  }
  .recommended-product-grid .toilet-product-image img {
    width: 112px !important;
    max-width: calc(100% - 10px);
    height: 112px !important;
    max-height: calc(100% - 10px);
  }
  .image-zoom-hint {
    position: absolute;
    right: 7px;
    bottom: 7px;
    border-radius: 999px;
    background: rgba(34, 33, 29, 0.82);
    padding: 4px 7px;
    color: #fff;
    font-size: 10px;
    line-height: 1;
    font-weight: 700;
    opacity: 0;
    pointer-events: none;
    transition: opacity 140ms ease;
  }
  .toilet-product-image-button:hover .image-zoom-hint,
  .toilet-product-image-button:focus-visible .image-zoom-hint {
    opacity: 1;
  }
  .toilet-product-image.empty span {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 700;
  }
  .toilet-product-body {
    display: grid;
    grid-template-rows: auto auto auto auto minmax(34px, auto) auto;
    gap: 7px;
    border-left: 1px solid #f0ece3;
    padding: 14px;
  }
  .toilet-product-meta {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 8px;
  }
  .toilet-product-meta span {
    margin-right: auto;
  }
  .toilet-product-meta b {
    border-radius: 999px;
    padding: 4px 8px;
    font-size: var(--text-caption);
    line-height: var(--leading-caption);
  }
  .toilet-product-meta .selected-badge {
    background: var(--color-primary);
    color: var(--color-cream);
  }
  .toilet-product-meta .recommend-badge {
    background: var(--color-gold-wash);
    color: #6d4d11;
  }
  .toilet-product-card h3 {
    margin: 0;
    min-height: 0;
    font-size: var(--text-body);
    line-height: 1.32;
    font-weight: 700;
    letter-spacing: 0;
    overflow-wrap: break-word;
  }
  .toilet-product-grid .toilet-product-card h3 {
    font-size: var(--text-body);
    line-height: 1.3;
  }
  .toilet-product-price {
    display: block;
    color: var(--color-text);
    font-size: 23px;
    line-height: 29px;
    font-weight: 700;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
  }
  .recommended-product-grid .toilet-product-price {
    font-size: 20px;
    line-height: 25px;
  }
  .recommended-product-grid .toilet-product-card h3 {
    font-size: var(--text-label);
    line-height: 1.25;
  }
  .recommended-product-grid .toilet-product-card p {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: var(--text-label);
    line-height: var(--leading-label);
  }
  .recommended-product-grid .toilet-product-card .toilet-product-sku {
    margin: -2px 0 0;
    font-size: 11px;
    line-height: 1.25;
  }
  .toilet-product-grid .toilet-product-price {
    font-size: 21px;
    line-height: 27px;
  }
  .toilet-product-card p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-body-sm);
    line-height: var(--leading-body-sm);
  }
  .toilet-product-note {
    overflow-wrap: break-word;
  }
  .toilet-product-note.compact {
    display: block;
    color: var(--color-text-muted);
    font-size: var(--text-label);
    line-height: var(--leading-label);
    font-weight: 500;
    overflow: visible;
  }
  .toilet-product-card .toilet-product-sku {
    margin: -1px 0 0;
    color: var(--color-text-muted);
    font-size: var(--text-caption);
    line-height: var(--leading-caption);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .toilet-product-grid .toilet-product-card p {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: var(--text-label);
    line-height: var(--leading-label);
  }
  .toilet-product-grid .toilet-product-card .toilet-product-note.compact {
    display: block;
    overflow: visible;
  }
  .toilet-product-grid .toilet-product-card .toilet-product-sku {
    display: block;
    margin: -2px 0 0;
    color: var(--color-text-muted);
    font-size: 11px;
    line-height: 1.25;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .toilet-card-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
    min-height: 38px;
  }
  .toilet-add-button,
  .toilet-replace-button {
    min-height: 38px;
    border: 1px solid var(--color-primary);
    border-radius: 8px;
    padding: 0 12px;
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 700;
    cursor: pointer;
  }
  .toilet-replace-button.primary {
    min-width: 78px;
    background: var(--color-primary);
    color: var(--color-cream);
  }
  .toilet-add-button,
  .toilet-replace-button {
    background: var(--color-surface);
    color: var(--color-primary);
  }
  .toilet-product-grid .toilet-add-button,
  .toilet-product-grid .toilet-replace-button {
    min-height: 34px;
    padding: 0 10px;
    font-size: var(--text-label);
    line-height: var(--leading-label);
  }
  .recommended-product-grid .toilet-card-actions {
    gap: 5px;
    min-height: 32px;
    justify-content: stretch;
  }
  .recommended-product-grid .toilet-add-button,
  .recommended-product-grid .toilet-replace-button {
    min-height: 32px;
    border-radius: 7px;
    padding: 0 8px;
    font-size: var(--text-label);
    line-height: var(--leading-label);
  }
  .recommended-product-grid .toilet-replace-button.primary {
    width: 100%;
  }
  .all-product-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .all-product-list .toilet-product-card {
    grid-template-columns: 92px minmax(0, 1fr);
    min-height: 118px;
  }
  .all-product-list .toilet-product-image {
    height: auto;
    min-height: 118px;
    border-right: 1px solid #f0ece3;
    border-bottom: 0;
  }
  .all-product-list .toilet-product-body {
    align-content: center;
    gap: 3px;
    padding: 8px 9px;
  }
  .all-product-list .toilet-product-meta {
    gap: 4px;
  }
  .all-product-list .toilet-product-meta span {
    font-size: var(--text-caption);
    line-height: var(--leading-caption);
  }
  .all-product-list .toilet-product-meta b {
    padding: 2px 6px;
    font-size: 10px;
    line-height: 1.2;
  }
  .all-product-list .toilet-product-card h3 {
    font-size: var(--text-label);
    line-height: 1.25;
  }
  .all-product-list .toilet-product-price {
    font-size: 19px;
    line-height: 24px;
  }
  .all-product-list .toilet-product-card p {
    -webkit-line-clamp: 1;
  }
  .all-product-list .toilet-product-card .toilet-product-note.compact {
    display: block;
    overflow: visible;
    font-size: 10px;
    line-height: 1.2;
  }
  .all-product-list .toilet-product-card .toilet-product-sku {
    font-size: 10px;
    line-height: 1.2;
  }
  .all-product-list .toilet-card-actions {
    justify-content: flex-start;
    gap: 5px;
    min-height: 31px;
  }
  .all-product-list .toilet-add-button,
  .all-product-list .toilet-replace-button {
    min-height: 31px;
    border-radius: 7px;
    padding: 0 7px;
    font-size: var(--text-caption);
    line-height: var(--leading-caption);
  }
  .all-product-list .toilet-replace-button.primary {
    min-width: 68px;
  }
  .product-image-modal {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(20, 18, 14, 0.58);
  }
  .product-image-dialog {
    width: min(720px, calc(100vw - 32px));
    max-height: calc(100vh - 48px);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 12px;
    border: 1px solid rgba(255, 250, 241, 0.5);
    border-radius: 10px;
    background: #fff;
    padding: 14px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
  }
  .product-image-modal-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 12px;
  }
  .product-image-modal-head div {
    min-width: 0;
    display: grid;
    gap: 3px;
  }
  .product-image-modal-head span,
  .product-image-modal-head small {
    color: var(--color-text-muted);
    font-size: var(--text-label);
    line-height: var(--leading-label);
    font-weight: 600;
  }
  .product-image-modal-head strong {
    color: var(--color-text);
    font-size: var(--text-h3);
    line-height: var(--leading-h3);
    font-weight: 700;
    overflow-wrap: break-word;
  }
  .product-image-modal-head button {
    min-height: 34px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    padding: 0 12px;
    color: var(--color-text);
    font: inherit;
    font-size: var(--text-label);
    line-height: var(--leading-label);
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }
  .product-image-modal-frame {
    min-height: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: #fff;
  }
  .product-image-modal-frame img {
    width: 100%;
    height: 100%;
    max-height: min(68vh, 620px);
    object-fit: contain;
    padding: 18px;
  }
  .product-image-modal-meta {
    display: grid;
    gap: 4px;
  }
  .product-image-modal-meta strong {
    color: var(--color-text);
    font-size: var(--text-price-sub);
    line-height: var(--leading-price-sub);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .product-image-modal-meta p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-body-sm);
    line-height: var(--leading-body-sm);
  }
  @media (max-width: 640px) {
    .product-image-modal {
      padding: 10px;
    }
    .product-image-dialog {
      width: 100%;
      max-height: calc(100vh - 20px);
      gap: 10px;
      padding: 10px;
    }
    .product-image-modal-head {
      align-items: center;
    }
    .product-image-modal-head strong {
      font-size: var(--text-body);
      line-height: 1.32;
    }
    .product-image-modal-frame img {
      max-height: 62vh;
      padding: 10px;
    }
  }
  .toilet-add-button:disabled,
  .toilet-replace-button:disabled {
    border-color: var(--color-border);
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    cursor: not-allowed;
  }
  .quantity-control {
    display: inline-grid;
    grid-template-columns: 34px minmax(30px, auto) 34px;
    align-items: center;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: #fff;
  }
  .quantity-control button {
    width: 34px;
    min-width: 34px;
    height: 34px;
    min-height: 34px;
    border: 0;
    border-radius: 0;
    padding: 0;
    background: transparent;
    color: var(--color-text);
    font: inherit;
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    box-shadow: none;
  }
  .quantity-control span {
    display: grid;
    place-items: center;
    min-width: 30px;
    height: 34px;
    border-inline: 1px solid var(--color-border);
    color: var(--color-text);
    font-size: var(--text-sm);
    font-weight: 700;
  }
  .calendar-panel {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 12px;
    background: rgba(255, 250, 241, 0.78);
  }
  .calendar-header,
  .calendar-weekdays,
  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
  }
  .calendar-header {
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    align-items: center;
    margin-bottom: 12px;
  }
  .calendar-header strong {
    text-align: center;
    font-size: 18px;
  }
  .calendar-header button {
    height: 40px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    font-weight: 600;
    cursor: pointer;
  }
  .calendar-weekdays {
    margin-bottom: 6px;
  }
  .calendar-weekdays span {
    text-align: center;
    color: var(--color-text-muted);
    font-size: var(--text-label);
    line-height: var(--leading-label);
    font-weight: 600;
  }
  .calendar-grid button {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 44px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
  }
  .calendar-grid button span {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border-radius: 999px;
  }
  .calendar-grid button.outside {
    color: #a4aaa0;
  }
  .calendar-grid button.today span {
    border: 1px solid var(--color-sage);
  }
  .calendar-grid button.selected span {
    border: 1px solid var(--color-primary);
    background: var(--color-primary);
    color: var(--color-cream);
    font-weight: 600;
  }
  .calendar-grid button.disabled {
    color: #c3c7bf;
    cursor: not-allowed;
    pointer-events: none;
    opacity: 0.45;
  }
  .calendar-grid button.disabled.today span {
    border-color: #c3c7bf;
  }
  .calendar-grid button.partially-booked {
    opacity: 1;
  }
  .calendar-grid button.partially-booked span {
    background: var(--color-gold-wash);
    color: var(--color-primary);
    font-weight: 700;
  }
  .calendar-grid button.partially-booked small {
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    color: var(--color-primary);
    font-size: var(--text-caption);
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
  }
  .calendar-grid button.all-full i {
    position: absolute;
    bottom: 1px;
    color: #d12f1f;
    font-size: 18px;
    font-style: normal;
    line-height: 1;
  }
  .calendar-grid button.blocked span {
    background: repeating-linear-gradient(135deg, #ece9e2 0, #ece9e2 4px, #d8d4cc 4px, #d8d4cc 8px);
  }
  .slot-skeleton-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 12px;
  }
  .slot-skeleton-grid span {
    min-height: 56px;
    border-radius: 8px;
    background: linear-gradient(90deg, var(--color-surface-2), #fff, var(--color-surface-2));
    background-size: 200% 100%;
    animation: slotPulse 1.2s ease-in-out infinite;
  }
  .slot-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
    border: 1px solid #ffd6c2;
    border-radius: 8px;
    padding: 12px;
    background: #fff4ec;
    color: var(--color-accent-orange);
  }
  .slot-error p {
    margin: 0;
    line-height: 1.5;
    font-weight: 700;
  }
  .slot-error button {
    min-height: 40px;
    border: 0;
    border-radius: 999px;
    padding: 0 14px;
    background: var(--color-accent-orange);
    color: #fff;
    font-weight: 700;
    white-space: nowrap;
  }
  @keyframes slotPulse {
    from { background-position: 200% 0; }
    to { background-position: -200% 0; }
  }
  .slot-grid.slide-down {
    margin-top: 12px;
    animation: slideDown 0.18s ease-out;
  }
  .slot-grid button {
    position: relative;
    display: grid;
    gap: 4px;
    text-align: left;
  }
  .slot-grid button b {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 700;
  }
  .slot-grid button.disabled {
    border-color: var(--color-border);
    background: var(--color-surface-2);
    color: var(--color-text-faint);
    cursor: not-allowed;
  }
  .slot-grid button small {
    position: absolute;
    right: 12px;
    top: 12px;
    padding: 2px 8px;
    border-radius: 999px;
    background: #f0ede8;
    color: var(--color-text-muted);
    font-size: 12px;
    font-weight: 700;
  }
  .slot-grid button.disabled small {
    background: #fee2e2;
    color: #991b1b;
  }
  .slot-grid button em {
    position: absolute;
    right: 14px;
    top: 14px;
    font-style: normal;
    font-weight: 700;
  }
  .slot-help {
    margin: 10px 0 0;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
  }
  .slot-help.strong {
    border-radius: 8px;
    background: var(--color-primary-highlight);
    padding: 10px 12px;
    color: var(--color-primary);
    font-weight: 700;
  }
  .home-info-section {
    display: grid;
    gap: 16px;
  }
  .required-progress {
    height: 8px;
    overflow: hidden;
    border-radius: var(--radius-full);
    background: var(--color-surface-2);
  }
  .required-progress span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--color-primary);
    transition: width var(--transition);
  }
  .home-info-block {
    display: grid;
    gap: 8px;
  }
  .home-info-block label,
  .home-info-grid label {
    color: var(--color-text);
    font-weight: 700;
  }
  .chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip-group.error .chip {
    border-color: #dc2626;
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.08);
  }
  .chip {
    min-height: 42px;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: var(--color-surface);
    padding: 0 16px;
    color: var(--color-text-muted);
    font-weight: 700;
    cursor: pointer;
  }
  .chip.active {
    border-color: var(--color-gold);
    background: var(--color-gold-wash);
    color: var(--color-primary);
  }
  .home-info-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .household-checks {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 12px;
  }
  .household-checks label {
    min-height: 48px;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 10px 12px;
    background: var(--color-surface-2);
    font-weight: 700;
    color: var(--color-text);
  }
  .request-note-field {
    margin-top: 16px;
  }
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .price-lines {
    display: grid;
    gap: 8px;
    margin: 0;
  }
  .quote-summary-card {
    display: grid;
    gap: 14px;
  }
  .quote-summary-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: end;
    border-radius: var(--radius-md);
    background: var(--color-primary-highlight);
    padding: var(--space-4);
  }
  .quote-summary-head span {
    color: var(--color-primary);
    font-size: var(--text-xs);
    font-weight: 700;
  }
  .quote-summary-head strong {
    font-size: var(--text-price-main);
    line-height: var(--leading-price-main);
    font-weight: 700;
    letter-spacing: -0.015em;
    font-variant-numeric: tabular-nums;
    overflow-wrap: break-word;
  }
  .quote-summary-head p {
    margin: 6px 0 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: 1.45;
  }
  .quote-payment-notes {
    display: grid;
    gap: 8px;
    margin-top: 2px;
    border-top: 1px solid var(--color-border);
    padding-top: 12px;
  }
  .quote-payment-notes p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: 1.5;
  }
  .quote-payment-notes p::before {
    content: "✓";
    margin-right: 6px;
    color: var(--color-primary);
    font-weight: 700;
  }
  .price-lines div,
  .price-total,
  .addon-row,
  .photo-preview {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
  }
  .price-lines dt,
  .price-lines dd {
    margin: 0;
    overflow-wrap: break-word;
  }
  .price-total {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid #edf0e8;
  }
  .price-summary {
    position: relative;
    overflow: hidden;
  }
  .price-summary::before {
    content: "Order Summary";
    display: block;
    margin-bottom: 10px;
    color: var(--color-text-muted);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .included-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding: 0;
    margin: 0;
    list-style: none;
  }
  .included-list li {
    background: var(--color-sage-soft);
    border-radius: 8px;
    padding: 12px;
  }
  .addon-list {
    display: grid;
    gap: 10px;
  }
  .addon-row input {
    width: 22px;
    height: 22px;
  }
  .upload-box {
    display: grid;
    gap: 6px;
    margin-top: 12px;
    background: var(--color-sage-soft);
  }
  .upload-box input {
    display: none;
  }
  .photo-preview-list {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }
  .photo-preview {
    background: var(--color-sage-soft);
    border-radius: 8px;
    padding: 10px 12px;
  }
  .photo-preview p {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  input {
    width: 100%;
    min-height: 56px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0 14px;
    margin-top: 10px;
    font-size: 16px;
    box-sizing: border-box;
  }
  .addon-row input[type="checkbox"],
  .addon-row input[type="radio"] {
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    min-height: 22px;
    margin: 0;
    padding: 0;
  }
  .household-checks input[type="checkbox"] {
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
    min-height: 18px;
    margin: 0;
    padding: 0;
  }
  .addon-row span {
    min-width: 0;
    overflow-wrap: break-word;
  }
  .addon-row strong {
    flex: 0 0 auto;
    white-space: nowrap;
  }
  .text-button {
    border: 0;
    background: transparent;
    color: var(--color-primary);
    font-size: var(--text-button);
    line-height: var(--leading-button);
  }
  .primary-button,
  .sticky-cta button {
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    color: #211c12;
    background: var(--color-gold);
  }
  .primary-button.disabled,
  .primary-button:disabled {
    border: 0;
    background: var(--color-sage-soft);
    color: var(--color-text-muted);
    cursor: not-allowed;
  }
  .address-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: 18px;
    background: rgba(0, 0, 0, 0.48);
  }
  .address-modal {
    width: min(720px, 100%);
    height: min(620px, 86vh);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
  }
  .address-modal-header {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid var(--color-border);
  }
  .address-modal-header p,
  .address-modal-error {
    margin: 4px 0 0;
    color: var(--color-text-muted);
  }
  .address-modal-header button {
    min-width: 64px;
    height: 40px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    font-weight: 700;
  }
  .address-modal-frame {
    min-height: 0;
  }
  .address-modal-error {
    padding: 18px;
  }
  .sticky-cta {
    box-sizing: border-box;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
    padding: 12px max(18px, calc((100vw - 980px) / 2));
    padding-bottom: calc(12px + var(--safe-area-bottom));
    background: rgba(255, 250, 241, 0.96);
    border-top: 1px solid var(--color-border);
  }
  .sticky-cta-head {
    grid-column: 1 / -1;
    display: grid;
    gap: 4px;
  }
  .sticky-cta-head span {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 600;
  }
  .sticky-cta-head strong {
    font-size: var(--text-price-main);
    line-height: var(--leading-price-main);
    font-weight: 700;
    letter-spacing: -0.015em;
    font-variant-numeric: tabular-nums;
  }
  .sticky-summary {
    grid-column: 1 / -1;
    display: grid;
    gap: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 0 12px;
    background: rgba(255, 250, 241, 0.78);
  }
  .sticky-summary div {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    min-height: 42px;
    border-bottom: 1px solid var(--color-border);
  }
  .sticky-summary div:last-child {
    border-bottom: 0;
  }
  .sticky-summary span {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 600;
  }
  .sticky-summary small {
    color: var(--color-text-muted);
    font-weight: 600;
    line-height: 1.4;
    overflow-wrap: break-word;
  }
  .sticky-selected-products {
    grid-column: 1 / -1;
    display: grid;
    gap: 9px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 10px 12px;
    background: rgba(255, 250, 241, 0.86);
  }
  .sticky-selected-products-title {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
  }
  .sticky-selected-products-title span,
  .sticky-selected-products-title strong {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 700;
  }
  .sticky-selected-product-summary {
    display: grid;
    gap: 3px;
    border-top: 1px solid var(--color-border);
    padding-top: 9px;
  }
  .sticky-selected-product-summary strong {
    display: block;
    color: var(--color-text);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: break-word;
  }
  .sticky-selected-product-summary small {
    display: block;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 600;
    line-height: 1.35;
  }
  .sticky-selected-product-summary.empty strong {
    color: var(--color-text-muted);
  }
  .sticky-payment-breakdown {
    display: grid;
    gap: 0;
    border-top: 1px solid var(--color-border);
    padding-top: 8px;
  }
  .sticky-payment-breakdown div {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    min-height: 30px;
  }
  .sticky-payment-breakdown span {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 700;
  }
  .sticky-payment-breakdown strong {
    color: var(--color-text);
    font-size: var(--text-price-sub);
    line-height: var(--leading-price-sub);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .sticky-cta p {
    grid-column: 1 / -1;
    font-size: var(--text-body-sm);
    line-height: var(--leading-body-sm);
  }
  .payment-method-options {
    grid-column: 1 / -1;
    display: grid;
    gap: 8px;
  }
  .payment-method-option {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr);
    align-items: center;
    min-height: 54px;
    border-radius: 12px;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    padding: 0 14px;
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: 700;
    transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  }
  .payment-method-option input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .payment-method-check {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border: 2px solid var(--color-border-strong);
    border-radius: 7px;
    color: transparent;
    font-size: 14px;
    line-height: 1;
    font-weight: 700;
  }
  .payment-method-option.active {
    border-color: var(--color-primary);
    background: var(--color-primary-highlight);
    color: var(--color-text);
    box-shadow: 0 0 0 1px rgba(33, 32, 27, 0.06);
  }
  .payment-method-option.active .payment-method-check {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: #fffaf1;
  }
  .payment-method-option:focus-within {
    outline: 3px solid rgba(199, 146, 42, 0.24);
    outline-offset: 2px;
  }
  .payment-consent {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    gap: 9px;
    align-items: start;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: rgba(255, 250, 241, 0.78);
    padding: 10px 12px;
    color: var(--color-text-muted);
    font-size: var(--text-caption);
    line-height: var(--leading-caption);
    font-weight: 600;
  }
  .payment-consent-text {
    min-width: 0;
    word-break: keep-all;
    line-break: strict;
    overflow-wrap: break-word;
  }
  .payment-consent-nowrap {
    display: inline-block;
    white-space: nowrap;
    word-break: keep-all;
  }
  .payment-consent input {
    width: 18px;
    height: 18px;
    margin: 1px 0 0;
    accent-color: var(--color-primary);
  }
  .payment-consent a {
    color: var(--color-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
    white-space: nowrap;
  }
  .sticky-cta .strong {
    background: var(--color-primary);
    color: var(--color-cream);
  }
  .returning-note {
    margin: 8px 0 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
  .returning-card {
    display: grid;
    gap: 6px;
    margin-top: 12px;
    padding: 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background: var(--color-primary-highlight);
  }
  .returning-card strong {
    color: var(--color-primary);
  }
  .returning-card p,
  .returning-card span,
  .returning-card small {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.5;
  }
  .sticky-cta button:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  @media (max-width: 900px) {
    .recommended-product-grid {
      grid-template-columns: 1fr;
    }
    .toilet-product-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .toilet-filter-row {
      align-items: stretch;
    }
  }
  @media (max-width: 720px) {
    .quote-page {
      padding: 12px 12px 178px;
    }
    .quote-hero {
      display: grid;
    }
    .hero-price-breakdown {
      width: 100%;
      min-width: 0;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      gap: 10px;
      padding: 14px;
    }
    .hero-breakdown-label {
      font-size: var(--text-label);
      line-height: var(--leading-label);
    }
    .hero-breakdown-item strong {
      font-size: var(--text-price-sub);
      line-height: var(--leading-price-sub);
    }
    .quote-flow-note {
      grid-template-columns: 1fr;
    }
    .quote-scope-cards {
      grid-template-columns: 1fr;
    }
    .quote-flow-note ol {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .recommended-product-grid,
    .toilet-product-grid {
      grid-template-columns: 1fr;
    }
    .custom-product-consult {
      grid-template-columns: 1fr;
      align-items: start;
    }
    .custom-product-consult a,
    .custom-product-consult button {
      width: 100%;
    }
    .toilet-product-card {
      grid-template-columns: 112px minmax(0, 1fr);
      min-height: 150px;
    }
    .all-product-list .toilet-product-card {
      grid-template-columns: 112px minmax(0, 1fr);
      min-height: 150px;
    }
    .toilet-product-image {
      min-height: 150px;
    }
    .all-product-list .toilet-product-image {
      min-height: 150px;
    }
    .toilet-product-image img {
      padding: 6px;
    }
    .toilet-product-body {
      gap: 6px;
      padding: 12px;
    }
    .toilet-product-price {
      font-size: 24px;
      line-height: 30px;
    }
    .included-list,
    .grade-grid,
    .customer-field-grid,
    .home-info-grid,
    .household-checks,
    .sticky-cta {
      grid-template-columns: 1fr;
      gap: 8px;
      padding-top: 8px;
    }
    .slot-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .sticky-summary {
      grid-template-columns: 1fr;
    }
    .sticky-cta p {
      display: none;
    }
    .sticky-cta-head {
      display: none;
    }
    .sticky-summary {
      display: none;
    }
    .sticky-summary small {
      display: none;
    }
    .sticky-cta button {
      min-height: 48px;
      padding: 10px 14px;
    }
    .payment-consent {
      padding: 8px 10px;
      font-size: 12px;
    }
  }
  @media (min-width: 1180px) {
    .quote-page {
      padding-right: 360px;
      padding-bottom: 32px;
    }
    .quote-hero,
    .quote-flow-note,
    .quote-scope-cards,
    .quote-section,
    .context-banner {
      max-width: 820px;
    }
    .sticky-cta {
      left: auto;
      right: max(18px, calc((100vw - 1180px) / 2));
      top: 112px;
      bottom: auto;
      width: 320px;
      max-height: calc(100vh - 136px);
      grid-template-columns: 1fr;
      gap: 14px;
      border: 1px solid rgba(25, 26, 23, 0.1);
      border-radius: 8px;
      padding: 18px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 14px 34px rgba(25, 26, 23, 0.1);
    }
    .sticky-cta p,
    .sticky-cta-head,
    .sticky-summary,
    .payment-consent {
      grid-column: auto;
    }
    .sticky-cta-head {
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 14px;
    }
    .sticky-summary {
      padding: 0 12px;
    }
    .sticky-message {
      border-radius: 8px;
      padding: 10px 12px;
      background: var(--color-primary-highlight);
      color: var(--color-primary);
      font-size: var(--text-sm);
      font-weight: 700;
    }
    .sticky-cta button {
      width: 100%;
      min-height: 52px;
      border-radius: 8px;
      box-shadow: 0 10px 20px rgba(26, 107, 90, 0.16);
    }
  }
  @media (max-width: 420px) {
    .calendar-panel {
      padding: 10px 8px;
    }
    .calendar-header,
    .calendar-weekdays,
    .calendar-grid {
      gap: 4px;
    }
    .calendar-grid button {
      min-height: 38px;
    }
    .calendar-grid button span {
      width: 32px;
      height: 32px;
      font-size: 14px;
    }
    .quote-flow-note ol {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .slot-skeleton-grid,
    .slot-error {
      grid-template-columns: 1fr;
    }
    .slot-error {
      align-items: stretch;
      flex-direction: column;
    }
    .sticky-cta {
      padding-inline: 10px;
    }
  }
  .quote-page {
    background: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-body);
  }
  .context-banner {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--color-primary-highlight);
    color: var(--color-primary);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: 500;
  }
  .quote-hero,
  .quote-flow-note,
  .quote-section {
    background: var(--color-surface);
    border-color: var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }
  .quote-flow-note span,
  .quote-flow-note p {
    color: var(--color-text-muted);
  }
  .quote-flow-note li {
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    border-radius: var(--radius-md);
  }
  .quote-flow-note b {
    background: var(--color-primary);
  }
  .quote-hero p,
  .muted,
  .guide-text,
  .sticky-cta p,
  .section-title-row span {
    color: var(--color-text-muted);
  }
  .hero-badge {
    background: var(--color-primary-highlight);
    color: var(--color-primary);
  }
  .price-summary {
    border-radius: var(--radius-lg);
  }
  .price-lines div {
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--color-border);
  }
  .price-total {
    border-top: 2px solid var(--color-text);
  }
  .price-total strong {
    font-size: var(--text-price-main);
    line-height: var(--leading-price-main);
    font-weight: 700;
    letter-spacing: -0.015em;
  }
  .included-list li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: transparent;
    padding: var(--space-2) 0;
  }
  .included-list li svg {
    flex: 0 0 auto;
    color: var(--color-primary);
  }
  .included-list li.excluded {
    color: var(--color-text-muted);
  }
  .included-list li.excluded svg {
    color: var(--color-text-muted);
  }
  .addon-row {
    border-color: var(--color-border);
    transition: background var(--transition), border-color var(--transition);
  }
  .addon-row.selected {
    border: 2px solid var(--color-primary);
    background: var(--color-primary-highlight);
  }
  .addon-row strong {
    color: var(--color-primary);
    font-weight: 600;
  }
  .photo-slot-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
    margin-top: var(--space-4);
  }
  .photo-slot {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    border: 1.5px dashed var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }
  .photo-slot label {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    align-content: center;
    gap: var(--space-2);
    color: var(--color-text-muted);
    cursor: pointer;
    text-align: center;
    padding: var(--space-2);
  }
  .photo-slot label strong {
    color: var(--color-text);
    font-size: var(--text-sm);
  }
  .photo-slot label span {
    max-width: 13ch;
    font-size: var(--text-caption);
    line-height: var(--leading-caption);
  }
  .photo-slot-caption {
    position: absolute;
    left: 8px;
    bottom: 8px;
    border-radius: var(--radius-full);
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.62);
    color: #fff;
    font-size: var(--text-caption);
    font-weight: 700;
  }
  .photo-slot input {
    display: none;
  }
  .photo-slot img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .photo-slot button {
    position: absolute;
    right: 8px;
    top: 8px;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.92);
    color: var(--color-text);
  }
  .address-trigger {
    width: 100%;
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 0 var(--space-4);
    background: var(--color-surface);
    color: var(--color-text-muted);
    text-align: left;
  }
  .address-trigger.filled {
    color: var(--color-text);
  }
  .address-trigger svg {
    color: var(--color-primary);
    flex: 0 0 auto;
  }
  .address-trigger small {
    margin-left: auto;
    color: var(--color-text-muted);
  }
  .calendar-grid button.selected span,
  .slot-grid button.selected {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-cream);
  }
  .slot-grid button.disabled,
  .slot-grid button.disabled.selected {
    border-color: var(--color-border);
    background: var(--color-surface-2);
    color: var(--color-text-faint);
  }
  .calendar-grid button.today span {
    border-color: var(--color-primary);
  }
  .chip {
    border-color: var(--color-border);
    color: var(--color-text-muted);
    transition: background var(--transition), border-color var(--transition), color var(--transition);
  }
  .chip.active {
    border-color: var(--color-primary);
    background: var(--color-primary-highlight);
    color: var(--color-primary);
  }
  .sticky-cta button,
  .primary-button {
    min-height: 54px;
    border-radius: 8px;
    background: var(--color-primary);
    color: var(--color-cream);
    font-size: var(--text-button);
    line-height: var(--leading-button);
    font-weight: 700;
    letter-spacing: -0.005em;
    transition: transform var(--transition), background var(--transition), opacity var(--transition);
  }
  .sticky-cta button:hover,
  .primary-button:hover {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
  }
  .sticky-cta button:disabled,
  .sticky-cta button[aria-disabled="true"],
  .primary-button:disabled,
  .primary-button.disabled {
    opacity: 0.4;
    cursor: pointer;
    transform: none;
  }
  .sticky-cta button:disabled,
  .primary-button:disabled,
  .primary-button.disabled {
    cursor: not-allowed;
  }
  .quote-page {
    padding-top: 12px;
  }
  .quote-hero {
    align-items: center;
    padding: 14px 16px;
  }
  .quote-hero h1 {
    margin: 4px 0;
    font-size: var(--text-h1);
    line-height: var(--leading-h1);
  }
  .quote-hero strong {
    font-size: var(--text-price-sub);
    line-height: var(--leading-price-sub);
    font-weight: 600;
  }
  .hero-badge {
    padding: 6px 10px;
    font-size: var(--text-xs);
  }
  .quote-flow-note {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    padding: 12px 14px;
  }
  .quote-flow-note strong {
    margin-top: 2px;
    font-size: var(--text-h3);
    line-height: var(--leading-h3);
  }
  .quote-flow-note p {
    display: none;
  }
  .quote-flow-note ol {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .quote-flow-note li {
    min-height: 40px;
    display: flex;
    justify-content: center;
    gap: 6px;
    padding: 0 8px;
    font-size: var(--text-xs);
    white-space: nowrap;
  }
  .quote-flow-note b {
    width: 20px;
    height: 20px;
  }
  .quote-optional-details.compact .photo-upload-section {
    max-width: none;
    margin: 0;
    border: 0;
    box-shadow: none;
    background: transparent;
    padding: 0;
  }
  .quote-form-panel {
    display: grid;
    gap: 0;
    padding: 0;
    overflow: hidden;
  }
  .form-step-block {
    display: grid;
    gap: 14px;
    padding: 18px;
    border-bottom: 1px solid var(--color-border);
  }
  .form-step-body {
    display: grid;
    gap: 14px;
  }
  .step-title-row {
    display: block;
  }
  .step-title-button {
    width: 100%;
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    text-align: left;
    cursor: pointer;
  }
  .step-title-button > span {
    display: grid;
    gap: 4px;
    min-width: 0;
    text-align: left;
  }
  .step-title-button h2 {
    margin: 0;
    color: var(--color-text);
  }
  .step-title-button small {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 700;
    line-height: 1.35;
  }
  .step-title-button strong {
    flex: 0 0 auto;
    border-radius: var(--radius-full);
    padding: 6px 10px;
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 700;
    line-height: 1;
  }
  .step-title-button .success-label {
    background: var(--color-primary-highlight);
    color: var(--color-primary);
  }
  .form-step-block:last-child {
    border-bottom: 0;
  }
  .form-step-block .section-title-row {
    margin-bottom: 0;
  }
  .form-step-block .data-guide-text {
    margin: -6px 0 0;
  }
  .form-step-block .field-label input,
  .form-step-block .home-info-grid input {
    margin-top: 6px;
  }
  .home-info-section {
    gap: 14px;
  }
  .chip {
    min-height: 38px;
    padding: 0 13px;
  }
  .quote-optional-details.compact {
    padding: 12px 14px;
  }
  .request-note-field {
    margin-top: 10px;
  }
  @media (max-width: 640px) {
    .quote-page {
      padding: 10px 10px 118px;
    }
    .quote-hero {
      grid-template-columns: minmax(0, 1fr) auto;
      padding: 12px;
    }
    .quote-flow-note {
      padding: 12px;
    }
    .quote-flow-note ol {
      grid-template-columns: 1fr;
    }
    .quote-flow-note li {
      min-height: 34px;
      justify-content: flex-start;
    }
    .form-step-block {
      padding: 14px 12px;
    }
    .form-step-block:not(.active) {
      gap: 0;
      padding-top: 12px;
      padding-bottom: 12px;
    }
    .form-step-block:not(.active) .form-step-body {
      display: none;
    }
    .form-step-block.completed:not(.active) .step-title-button {
      color: var(--color-text);
    }
    .section-title-row h2 {
      font-size: var(--text-h3);
      line-height: var(--leading-h3);
    }
    .data-guide-text {
      font-size: var(--text-body-sm);
      line-height: var(--leading-body-sm);
    }
    .photo-slot-grid {
      gap: var(--space-2);
    }
    .sticky-cta {
      padding: 8px 10px;
    }
    .sticky-cta button {
      min-height: 48px;
      padding: 10px 14px;
      font-size: var(--text-sm);
    }
    .quote-optional-details summary {
      grid-template-columns: minmax(0, 1fr);
    }
    .quote-optional-details summary::after {
      width: fit-content;
    }
  }
  @media (min-width: 1180px) {
    .quote-page {
      padding-right: 360px;
      padding-bottom: 32px;
    }
    .quote-hero,
    .quote-flow-note,
    .quote-scope-cards,
    .quote-section,
    .context-banner {
      max-width: 820px;
    }
    .sticky-cta {
      left: auto;
      right: max(18px, calc((100vw - 1180px) / 2));
      top: 112px;
      bottom: auto;
      width: 320px;
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
      border: 1px solid rgba(25, 26, 23, 0.1);
      border-radius: 10px;
      padding: 18px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 14px 34px rgba(25, 26, 23, 0.1);
    }
    .sticky-cta-head {
      display: grid;
      grid-column: auto;
      gap: 4px;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 14px;
    }
    .sticky-cta-head span {
      color: var(--color-text-muted);
      font-size: var(--text-xs);
      font-weight: 700;
    }
    .sticky-cta-head strong {
      font-size: var(--text-price-main);
      line-height: var(--leading-price-main);
    }
    .sticky-summary {
      grid-column: auto;
      display: grid;
      gap: 0;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 0 12px;
      background: rgba(255, 250, 241, 0.78);
    }
    .sticky-summary div {
      display: grid;
      grid-template-columns: 72px minmax(0, 1fr);
      gap: 10px;
      min-height: 42px;
      align-items: center;
      border-bottom: 1px solid var(--color-border);
    }
    .sticky-summary div:last-child {
      border-bottom: 0;
    }
    .sticky-summary span {
      color: var(--color-text-muted);
      font-size: var(--text-xs);
      font-weight: 700;
    }
    .sticky-summary small {
      display: block;
      color: var(--color-text-muted);
      font-size: var(--text-sm);
      font-weight: 700;
      line-height: 1.4;
    }
    .sticky-message {
      display: block;
      grid-column: auto;
      margin: 0;
      border-radius: 8px;
      padding: 10px 12px;
      background: var(--color-primary-highlight);
      color: var(--color-primary);
      font-size: var(--text-sm);
      font-weight: 700;
      line-height: 1.45;
    }
    .sticky-cta .payment-button {
      width: 100%;
      min-height: 52px;
      border: 0;
      border-radius: 8px;
      padding: 0 14px;
      background: var(--color-primary);
      color: var(--color-cream);
      box-shadow: 0 10px 20px rgba(184, 138, 43, 0.2);
    }
  }
  @media (max-width: 720px) {
    .sticky-cta-head,
    .sticky-summary,
    .sticky-message {
      display: none;
    }
  }
  @media (max-width: 640px) {
    .quote-page {
      padding: 1.25rem 18px 10rem;
    }
    .quote-section,
    .quote-hero,
    .quote-flow-note,
    .context-banner {
      margin-bottom: 1rem;
      border-radius: 12px;
    }
    .quote-page {
      max-width: 100%;
      overflow-x: hidden;
    }
    .quote-hero,
    .quote-flow-note,
    .quote-scope-cards,
    .quote-section,
    .context-banner,
    .quote-form-panel,
    .form-step-block,
    .sticky-cta {
      width: 100%;
      max-width: 100%;
      min-width: 0;
    }
    .sticky-cta > * {
      min-width: 0;
    }
    .quote-hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
    }
    .hero-badge {
      width: fit-content;
      white-space: normal;
    }
    .section-title-row {
      flex-wrap: wrap;
      align-items: flex-start;
    }
    .section-title-row span {
      min-width: 0;
      text-align: left;
      overflow-wrap: break-word;
    }
    .addon-row,
    .price-lines div,
    .price-total,
    .quote-summary-head,
    .address-trigger {
      min-width: 0;
    }
    .addon-row strong {
      max-width: 42%;
      white-space: normal;
      text-align: right;
      overflow-wrap: break-word;
    }
    .address-trigger {
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .address-trigger small {
      margin-left: 0;
    }
    .payment-consent-text {
      min-width: 0;
      overflow-wrap: break-word;
    }
    .payment-consent {
      border-radius: 10px;
      padding: 0.75rem 0.875rem;
      line-height: 1.55;
    }
    .sticky-cta {
      gap: 0.625rem;
      padding: 0.75rem 18px;
      padding-bottom: calc(0.75rem + var(--safe-area-bottom));
      background: rgba(255, 250, 241, 0.98);
      box-shadow: 0 -10px 28px rgba(34, 33, 29, 0.08);
    }
    .sticky-cta button,
    .sticky-cta .payment-button {
      width: 100%;
      min-width: 0;
      min-height: 52px;
      white-space: normal;
      overflow-wrap: break-word;
    }
    .quote-page ~ .global-footer {
      padding-bottom: 160px;
    }
  }
  .quote-flow-note {
    display: grid;
    grid-template-columns: minmax(160px, 220px) minmax(0, 1fr);
    align-items: center;
    gap: 28px;
    margin: 0 auto 18px;
    padding: 10px 4px 18px;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
  .quote-flow-summary {
    min-width: 0;
  }
  .quote-flow-note .quote-flow-current {
    display: inline-block;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: 700;
  }
  .quote-flow-note strong {
    display: block;
    margin-top: 4px;
    font-size: var(--text-h2);
    line-height: var(--leading-h2);
    font-weight: 700;
    letter-spacing: -0.018em;
  }
  .quote-flow-note p,
  .quote-flow-note em {
    margin: 8px 0 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: 1.5;
  }
  .quote-flow-note em {
    color: var(--color-primary);
    font-style: normal;
    font-weight: 700;
  }
  .quote-flow-note .quote-step-diagram {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: start;
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .quote-flow-note .quote-step-node {
    position: relative;
    min-height: auto;
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 9px;
    padding: 0;
    background: transparent;
    border-radius: 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: 700;
    text-align: center;
  }
  .quote-flow-note .quote-step-node:not(:last-child)::after {
    content: "→";
    position: absolute;
    top: 25px;
    left: calc(100% - 10px);
    transform: translate(-50%, -50%);
    color: var(--color-border-strong);
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
  }
  .quote-flow-note .step-number {
    width: 56px;
    height: 56px;
    display: grid;
    place-items: center;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-sm);
    font-size: 20px;
    font-weight: 700;
  }
  .quote-flow-note .step-label {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.25;
    white-space: nowrap;
  }
  .quote-flow-note .quote-step-node.current .step-number {
    border-color: var(--color-charcoal-panel);
    background: var(--color-charcoal-panel);
    color: var(--color-cream);
    box-shadow: 0 14px 28px rgba(34, 33, 29, 0.14);
  }
  .quote-flow-note .quote-step-node.current .step-label {
    color: var(--color-text);
  }
  .quote-flow-note .quote-step-node.done .step-number {
    border-color: var(--color-sage);
    background: var(--color-sage-soft);
    color: var(--color-primary);
  }
  .quote-flow-note .quote-step-node.done .step-label {
    color: var(--color-primary);
  }
  @media (max-width: 720px) {
    .quote-flow-note {
      grid-template-columns: 1fr;
      gap: 14px;
      padding: 8px 2px 16px;
    }
    .quote-flow-summary {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: end;
      gap: 4px 12px;
    }
    .quote-flow-note .quote-flow-current {
      align-self: end;
    }
    .quote-flow-note strong {
      margin: 0;
      text-align: right;
    }
    .quote-flow-note p,
    .quote-flow-note em {
      grid-column: 1 / -1;
      margin-top: 4px;
    }
  }
  @media (max-width: 640px) {
    .quote-flow-note {
      margin-bottom: 1rem;
      padding: 4px 0 14px;
    }
    .quote-flow-note .quote-step-diagram {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .quote-flow-note .step-number {
      width: 44px;
      height: 44px;
      font-size: 17px;
    }
    .quote-flow-note .step-label {
      font-size: var(--text-xs);
    }
    .quote-flow-note .quote-step-node:not(:last-child)::after {
      top: 20px;
      left: calc(100% - 7px);
      font-size: 17px;
    }
  }
  .sticky-sheet-content {
    display: contents;
  }
  .sticky-cta .mobile-summary-toggle {
    display: none;
  }
  @media (max-width: 720px) {
    .sticky-cta {
      grid-template-columns: 1fr;
    }
    .sticky-cta .mobile-summary-toggle {
      width: 100%;
      min-height: 58px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      border: 1px solid rgba(34, 33, 29, 0.92);
      border-radius: 12px;
      padding: 0 14px;
      background: rgba(34, 33, 29, 0.94);
      color: var(--color-cream);
      text-align: left;
      box-shadow: 0 12px 28px rgba(34, 33, 29, 0.16);
    }
    .sticky-cta .mobile-summary-toggle span {
      min-width: 0;
      font-size: var(--text-sm);
      font-weight: 700;
      overflow-wrap: break-word;
    }
    .sticky-cta .mobile-summary-toggle strong {
      font-size: var(--text-price-sub);
      line-height: var(--leading-price-sub);
      font-weight: 700;
      white-space: nowrap;
    }
    .sticky-cta .sticky-sheet-content {
      display: none;
    }
    .sticky-cta.expanded {
      max-height: calc(88vh - env(safe-area-inset-bottom));
      overflow: auto;
      border-radius: 16px 16px 0 0;
    }
    .sticky-cta.expanded .sticky-sheet-content {
      display: grid;
      gap: 10px;
    }
    .sticky-cta.expanded .sticky-cta-head,
    .sticky-cta.expanded .sticky-summary,
    .sticky-cta.expanded .sticky-selected-products {
      display: grid;
    }
    .sticky-cta.expanded .sticky-message {
      display: block;
    }
  }
  @media (max-width: 640px) {
    .quote-page {
      padding: 10px 10px 96px;
    }
    .quote-section,
    .quote-hero,
    .context-banner {
      margin-bottom: 10px;
      padding: 12px;
    }
    .quote-hero {
      gap: 10px;
    }
    .quote-hero p {
      margin-bottom: 4px;
      font-size: var(--text-body-sm);
      line-height: var(--leading-body-sm);
    }
    .quote-hero h1 {
      font-size: var(--text-h1);
      line-height: var(--leading-h1);
    }
    .quote-hero strong {
      font-size: var(--text-price-sub);
      line-height: var(--leading-price-sub);
    }
    .hero-price-breakdown {
      gap: 6px;
      padding: 10px;
    }
    .hero-breakdown-item {
      gap: 4px;
    }
    .hero-breakdown-label {
      font-size: var(--text-label);
      line-height: var(--leading-label);
    }
    .hero-info-icon svg {
      width: 15px;
      height: 15px;
    }
    .hero-breakdown-item strong {
      font-size: 1.45rem;
    }
    .hero-price-breakdown b {
      font-size: 1.65rem;
    }
    .toilet-product-catalog {
      gap: 10px;
      padding: 14px 12px;
      scroll-margin-top: 72px;
    }
    .toilet-product-catalog .section-title-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: end;
    }
    .toilet-product-catalog .section-title-row h2 {
      font-size: var(--text-h3);
      line-height: var(--leading-h3);
    }
    .toilet-product-catalog .section-title-row span {
      align-self: end;
      font-size: var(--text-label);
      line-height: var(--leading-label);
      white-space: nowrap;
    }
    .toilet-product-catalog > .data-guide-text {
      display: none;
    }
    .product-index-chips {
      gap: 6px;
      margin-inline: -12px;
      padding: 0 12px 4px;
    }
    .product-index-chips button,
    .filter-chip-group button {
      min-height: 30px;
      padding: 0 10px;
      font-size: var(--text-label);
      line-height: var(--leading-label);
    }
    .toilet-filter-row {
      gap: 6px;
      padding: 10px 0;
      overflow: hidden;
    }
    .filter-chip-group {
      grid-template-columns: 48px minmax(0, 1fr);
      gap: 6px;
      padding-inline: 10px;
    }
    .filter-chip-group > span {
      font-size: var(--text-caption);
      line-height: var(--leading-caption);
    }
    .filter-chip-scroll {
      flex-wrap: nowrap;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      -webkit-overflow-scrolling: touch;
      padding-right: 10px;
    }
    .product-subsection-title {
      gap: 2px;
    }
    .product-subsection-title strong {
      font-size: var(--text-h3);
      line-height: var(--leading-h3);
    }
    .product-subsection-title span {
      font-size: var(--text-body-sm);
      line-height: var(--leading-body-sm);
    }
    .recommended-products,
    .product-results {
      gap: 8px;
      scroll-margin-top: 72px;
    }
    .recommended-product-grid,
    .toilet-product-grid {
      gap: 8px;
    }
    .recommended-product-grid .toilet-product-card,
    .toilet-product-card {
      grid-template-columns: 98px minmax(0, 1fr);
      min-height: 126px;
      border-radius: 8px;
    }
    .recommended-product-grid .toilet-product-card {
      grid-template-columns: 1fr;
      min-height: 0;
    }
    .all-product-list .toilet-product-card {
      grid-template-columns: 98px minmax(0, 1fr);
      min-height: 126px;
    }
    .recommended-product-grid .toilet-product-image,
    .toilet-product-image {
      height: 126px;
      min-height: 126px;
      border-right: 1px solid #f0ece3;
      border-bottom: 0;
    }
    .recommended-product-grid .toilet-product-image {
      height: 116px;
      min-height: 116px;
      border-right: 0;
      border-bottom: 1px solid #f0ece3;
    }
    .all-product-list .toilet-product-image {
      min-height: 126px;
    }
    .toilet-product-image img {
      padding: 4px;
    }
    .recommended-product-grid .toilet-product-body,
    .toilet-product-body {
      gap: 4px;
      border-left: 0;
      padding: 9px 10px;
    }
    .recommended-product-grid .toilet-product-body {
      gap: 5px;
      padding: 10px;
    }
    .toilet-product-meta {
      gap: 5px;
    }
    .toilet-product-meta span {
      font-size: var(--text-label);
      line-height: var(--leading-label);
    }
    .toilet-product-meta b {
      padding: 3px 7px;
      font-size: var(--text-caption);
      line-height: var(--leading-caption);
    }
    .toilet-product-card h3 {
      font-size: var(--text-body);
      line-height: 1.35;
    }
    .toilet-product-price {
      font-size: 24px;
      line-height: 30px;
    }
    .toilet-product-card p {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      font-size: var(--text-body-sm);
      line-height: var(--leading-body-sm);
    }
    .toilet-card-actions {
      gap: 6px;
      min-height: 34px;
    }
    .toilet-add-button,
    .toilet-replace-button {
      min-height: 34px;
      border-radius: 7px;
      padding: 0 9px;
      font-size: var(--text-button);
      line-height: var(--leading-button);
    }
    .toilet-replace-button.primary {
      min-width: 72px;
    }
    .quantity-control {
      grid-template-columns: 30px minmax(28px, auto) 30px;
      border-radius: 7px;
    }
    .quantity-control button {
      width: 30px;
      min-width: 30px;
      height: 30px;
      min-height: 30px;
      font-size: 17px;
    }
    .quantity-control span {
      min-width: 28px;
      height: 30px;
      font-size: 0.875rem;
    }
    .custom-product-consult {
      gap: 10px;
      padding: 12px;
    }
    .custom-product-consult strong {
      margin-bottom: 4px;
      font-size: 1.05rem;
    }
    .custom-product-consult p {
      font-size: var(--text-body-sm);
      line-height: var(--leading-body-sm);
    }
    .custom-product-consult a,
    .custom-product-consult button {
      min-height: 42px;
      font-size: 0.875rem;
    }
    .sticky-cta {
      gap: 6px;
      padding: 8px 10px;
      padding-bottom: calc(8px + var(--safe-area-bottom));
    }
    .sticky-cta .mobile-summary-toggle {
      min-height: 50px;
      border-radius: 10px;
      padding: 0 12px;
      box-shadow: 0 8px 22px rgba(34, 33, 29, 0.14);
    }
    .sticky-cta .mobile-summary-toggle span {
      font-size: var(--text-body-sm);
      line-height: var(--leading-body-sm);
    }
    .sticky-cta .mobile-summary-toggle strong {
      font-size: var(--text-price-sub);
      line-height: var(--leading-price-sub);
    }
    .sticky-cta.expanded {
      max-height: calc(84vh - env(safe-area-inset-bottom));
    }
  }
  @media (min-width: 1180px) {
    .quote-page {
      display: grid;
      grid-template-columns: minmax(0, 820px) 352px;
      align-items: start;
      justify-content: center;
      column-gap: 24px;
      padding: 14px 18px 48px;
    }
    .quote-page > :not(style):not(.sticky-cta) {
      grid-column: 1;
      width: 100%;
      max-width: 820px;
    }
    .sticky-cta {
      position: sticky;
      grid-column: 2;
      grid-row: 1 / span 100;
      align-self: start;
      left: auto;
      right: auto;
      top: 74px;
      bottom: auto;
      width: 352px;
      max-height: calc(100vh - 98px);
      gap: 12px;
      padding: 20px;
      border: 1px solid rgba(25, 26, 23, 0.1);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 14px 34px rgba(25, 26, 23, 0.1);
    }
    .sticky-cta.has-product-selection {
      gap: 12px;
      padding: 20px;
    }
    .sticky-cta.has-product-selection .sticky-cta-head {
      padding-bottom: 12px;
    }
    .sticky-cta.has-product-selection .sticky-summary {
      grid-template-columns: 1fr;
      padding: 0 10px;
    }
    .sticky-cta.has-product-selection .sticky-summary div {
      grid-template-columns: 44px minmax(0, 1fr);
      min-height: 34px;
      gap: 8px;
      border-bottom: 1px solid var(--color-border);
    }
    .sticky-cta.has-product-selection .sticky-summary div:last-child {
      border-bottom: 0;
    }
    .sticky-cta.has-product-selection .sticky-summary small {
      font-size: var(--text-xs);
      line-height: 1.3;
    }
    .sticky-cta.has-product-selection .sticky-message,
    .sticky-cta.has-product-selection .payment-consent {
      padding: 8px 10px;
      font-size: var(--text-caption);
      line-height: var(--leading-caption);
    }
    .sticky-cta.has-product-selection .payment-method-option {
      min-height: 46px;
    }
    .sticky-cta.has-product-selection .payment-button {
      min-height: 56px;
    }
  }
  @media (max-width: 720px) {
    .sticky-cta.expanded.has-product-selection {
      max-height: calc(88vh - env(safe-area-inset-bottom));
    }
  }
`;
