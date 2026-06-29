"use client";

import Link from "next/link";
import {
  AlertCircle,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplets,
  FileText,
  ImagePlus,
  Info,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Wallet,
  Wrench,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AddressModal, type AddressSelection } from "@/components/common/AddressModal";
import { openEstimatePreviewWindow } from "@/components/builduscare/estimate-preview-storage";
import { MobileAppBar } from "@/components/builduscare/MobileAppChrome";
import { appendOptimizedPhotos, optimizePhotoFile } from "@/components/builduscare/photo-upload-utils";
import type { ProductSelection } from "@/components/builduscare/product-types";
import {
  defaultColor,
  formatKRW,
  normalizeSelectedColor,
  productDisplayLabel,
  productTotals
} from "@/components/builduscare/product-helpers";
import {
  BUILDUSCARE_CATEGORIES,
  findBuilduscareCategoryByService
} from "@/lib/builduscare-public-routes";
import {
  getBuilduscarePublicCatalog,
  type BuilduscarePublicProduct
} from "@/lib/builduscare-public-products";
import {
  isClosedReservationDate,
  isKoreanPublicHoliday,
  minReservationDateText
} from "@/lib/reservation-policy";

type ReservationStep = "info" | "schedule" | "confirm" | "complete";
type SlotPeriod = "morning" | "afternoon";

type ReservationDraft = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  roadAddress: string;
  detailAddress: string;
  postalCode: string;
  date: string;
  time: SlotPeriod | "";
  regionConfirmed: boolean;
  specConfirmed: boolean;
  privacyAccepted: boolean;
  selfDisposal: boolean;
  cashReceiptType: "none" | "personal" | "business";
  cashReceiptIdentity: string;
};

type ReservationFlowClientProps = {
  step: ReservationStep;
  initial?: Partial<ReservationDraft>;
};

type StoredSelection = {
  id?: string;
  selectedColor?: string;
  qty?: number;
  product?: BuilduscarePublicProduct;
};

type SlotDayInfo = {
  date: string;
  blocked?: boolean;
  beforeMinDate?: boolean;
  allFull?: boolean;
  slots?: Record<SlotPeriod, {
    used?: number;
    cap?: number;
    usedCount?: number;
    maxCount?: number;
    isFull?: boolean;
    available?: boolean;
  }>;
};

type OrderResult = {
  orderNumber: string;
  statusUrl?: string;
  transferUrl?: string | null;
  customerName?: string;
  item?: string;
  itemLabel?: string;
  selected?: Array<{
    id: string;
    name: string;
    image?: string;
    qty: number;
    price: number;
    selectedColor?: string;
    serviceCode?: string;
    categoryName?: string;
  }>;
  photoCount?: number;
  totals?: {
    productAmount?: number;
    laborAmount?: number;
    totalAmount?: number;
    onlinePaymentAmount?: number;
    onsitePaymentAmount?: number;
  };
  cashReceipt?: { text?: string } | null;
  payment?: { status?: string; amount?: number } | null;
};

type ReservationPhoto = {
  file: File;
  url: string;
};

type StoredReservationPhoto = {
  name: string;
  type: string;
  lastModified: number;
  dataUrl: string;
};

const STORAGE_KEY = "builduscare:reservationDraft";
const PRODUCT_SELECTIONS_STORAGE_KEY = "builduscare:productSelections";
const PRODUCT_ORDER_PREFS_STORAGE_KEY = "builduscare:productOrderPrefs";
const PRODUCT_SELECTIONS_COOKIE_KEY = "builduscare_productSelections";
const PRODUCT_ORDER_PREFS_COOKIE_KEY = "builduscare_productOrderPrefs";
const ORDER_RESULT_STORAGE_KEY = "builduscare:lastOrderResult";
const RESERVATION_PHOTOS_STORAGE_KEY = "builduscare:reservationPhotos";
const DATE_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const ALL_PRODUCTS: BuilduscarePublicProduct[] = BUILDUSCARE_CATEGORIES.flatMap((category) => (
  getBuilduscarePublicCatalog(category.serviceCode)?.products ?? []
));

let reservationPhotoStore: ReservationPhoto[] = [];
const EMPTY_INITIAL_DRAFT: Partial<ReservationDraft> = {};

function defaultDraft(initial: Partial<ReservationDraft> = {}): ReservationDraft {
  return {
    orderId: initial.orderId ?? "",
    orderNumber: initial.orderNumber ?? "",
    customerName: initial.customerName ?? "",
    phone: initial.phone ?? "",
    roadAddress: initial.roadAddress ?? "",
    detailAddress: initial.detailAddress ?? "",
    postalCode: initial.postalCode ?? "",
    date: initial.date ?? "",
    time: initial.time ?? "",
    regionConfirmed: initial.regionConfirmed ?? false,
    specConfirmed: initial.specConfirmed ?? false,
    privacyAccepted: initial.privacyAccepted ?? false,
    selfDisposal: initial.selfDisposal ?? false,
    cashReceiptType: initial.cashReceiptType ?? "none",
    cashReceiptIdentity: initial.cashReceiptIdentity ?? ""
  };
}

function datePad(value: number) {
  return String(value).padStart(2, "0");
}

function localIsoDate(date: Date) {
  return `${date.getFullYear()}-${datePad(date.getMonth() + 1)}-${datePad(date.getDate())}`;
}

function addLocalDays(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function bookingToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function bookingEarliestDate() {
  const [year, month, day] = minReservationDateText(bookingToday()).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function bookingMonthBase() {
  const earliest = bookingEarliestDate();
  return { year: earliest.getFullYear(), month: earliest.getMonth(), earliest };
}

function monthKey(year: number, month: number) {
  return `${year}-${datePad(month + 1)}`;
}

function dateLabel(dateText: string, includeYear = false) {
  if (!dateText) return "일정 미선택";
  const [year, month, day] = dateText.split("-").map(Number);
  if (!year || !month || !day) return "일정 미선택";
  const date = new Date(year, month - 1, day);
  return `${includeYear ? `${year}년 ` : ""}${month}월 ${day}일 (${DATE_WEEKDAYS[date.getDay()]})`;
}

function slotLabel(slot: SlotPeriod | "") {
  if (slot === "morning") return "오전";
  if (slot === "afternoon") return "오후";
  return "시간대 미선택";
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function cashReceiptIdentity(draft: ReservationDraft) {
  if (draft.cashReceiptType === "none") return "";
  if (draft.cashReceiptType === "personal") return digits(draft.cashReceiptIdentity) || digits(draft.phone);
  return digits(draft.cashReceiptIdentity);
}

function cashReceiptText(draft: ReservationDraft) {
  if (draft.cashReceiptType === "none") return "신청 안 함";
  const value = cashReceiptIdentity(draft) || "정보 입력 전";
  return draft.cashReceiptType === "business" ? `사업자 지출증빙 / ${value}` : `개인 소득공제 / ${value}`;
}

function cashReceiptOk(draft: ReservationDraft) {
  if (draft.cashReceiptType === "none") return true;
  return cashReceiptIdentity(draft).length >= 10;
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

function restoreSelections(): ProductSelection[] {
  try {
    const stored = readClientStorage(PRODUCT_SELECTIONS_STORAGE_KEY, PRODUCT_SELECTIONS_COOKIE_KEY);
    const rows = stored ? JSON.parse(stored) as StoredSelection[] : [];
    if (!Array.isArray(rows)) return [];
    const restored: ProductSelection[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const snapshot = row.product && typeof row.product === "object" ? row.product : null;
      const product = ALL_PRODUCTS.find((item) => item.id === row.id)
        ?? ALL_PRODUCTS.find((item) => snapshot?.sku && item.serviceCode === snapshot.serviceCode && item.sku === snapshot.sku)
        ?? ALL_PRODUCTS.find((item) => snapshot?.displayModel && item.serviceCode === snapshot.serviceCode && item.displayModel === snapshot.displayModel)
        ?? ALL_PRODUCTS.find((item) => snapshot?.model && item.serviceCode === snapshot.serviceCode && item.model === snapshot.model);
      if (!product) continue;
      const selectedColor = normalizeSelectedColor(product, row.selectedColor ?? defaultColor(product));
      const key = `${product.id}::${selectedColor || "default"}`;
      if (seen.has(key)) continue;
      seen.add(key);
      restored.push({
        product,
        selectedColor,
        qty: Math.max(1, Math.min(20, Number(row.qty || 1)))
      });
    }
    return restored;
  } catch {
    return [];
  }
}

function restoreSelectionsFromOrderResult(order: OrderResult | null): ProductSelection[] {
  const rows = order?.selected ?? [];
  const restored: ProductSelection[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const product = ALL_PRODUCTS.find((item) => item.id === row.id);
    if (!product) continue;
    const selectedColor = normalizeSelectedColor(product, row.selectedColor ?? defaultColor(product));
    const key = `${product.id}::${selectedColor || "default"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    restored.push({
      product: {
        ...product,
        image: row.image || product.image,
        roundedPrice: Number(row.price || product.roundedPrice)
      },
      selectedColor,
      qty: Math.max(1, Math.min(20, Number(row.qty || 1)))
    });
  }
  return restored;
}

function productCategoryTitle(product: BuilduscarePublicProduct) {
  return findBuilduscareCategoryByService(product.serviceCode)?.title ?? product.categoryName;
}

function orderItemLabel(selections: ProductSelection[]) {
  const labels = Array.from(new Set(selections.map((item) => productCategoryTitle(item.product)))).filter(Boolean);
  if (labels.length === 0) return "제품 교체";
  return labels.length > 1 ? `${labels.join(" + ")} 교체` : `${labels[0]} 교체`;
}

function photoLabel(count: number) {
  return count > 0 ? `${count}장 첨부됨` : "미첨부 (선택)";
}

function donePhotoLabel(count?: number) {
  return `사진 ${Number(count ?? 0)}장`;
}

function standaloneFallbackOrderNumber() {
  const dateText = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date()).replace(/-/g, "");
  return `BC-${dateText}-678`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(photo: StoredReservationPhoto) {
  try {
    const [meta, payload] = String(photo.dataUrl ?? "").split(",");
    if (!meta || !payload) return null;
    const mime = meta.match(/data:([^;]+)/)?.[1] || photo.type || "image/jpeg";
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new File([bytes], photo.name || "photo.jpg", {
      type: mime,
      lastModified: Number(photo.lastModified || Date.now())
    });
  } catch {
    return null;
  }
}

function restoreReservationPhotosFromSession() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(RESERVATION_PHOTOS_STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) as StoredReservationPhoto[] : [];
    if (!Array.isArray(stored)) return [];
    return stored.slice(0, 3).flatMap((photo) => {
      const file = dataUrlToFile(photo);
      return file ? [{ file, url: URL.createObjectURL(file) }] : [];
    });
  } catch {
    return [];
  }
}

async function persistReservationPhotosToSession(photos: ReservationPhoto[]) {
  if (typeof window === "undefined") return;
  try {
    const payload = await Promise.all(photos.slice(0, 3).map(async ({ file }) => ({
      name: file.name || "photo.jpg",
      type: file.type || "image/jpeg",
      lastModified: file.lastModified || Date.now(),
      dataUrl: await fileToDataUrl(file)
    })));
    window.sessionStorage.setItem(RESERVATION_PHOTOS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Large images can exceed session storage. The in-memory photo store still keeps the current flow usable.
  }
}

function clearReservationPhotosFromSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RESERVATION_PHOTOS_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

function slotAvailable(day: SlotDayInfo | undefined, period: SlotPeriod) {
  const slot = day?.slots?.[period];
  return slot?.available !== false && slot?.isFull !== true;
}

function dayFull(day: SlotDayInfo | undefined) {
  return Boolean(day?.allFull || (day?.slots?.morning?.isFull && day?.slots?.afternoon?.isFull));
}

function dayTag(day: SlotDayInfo | undefined, isClosed: boolean) {
  if (isClosed) return "휴무";
  if (!day) return "";
  if (day.beforeMinDate) return "";
  const morningFull = day.slots?.morning?.available === false || day.slots?.morning?.isFull;
  const afternoonFull = day.slots?.afternoon?.available === false || day.slots?.afternoon?.isFull;
  if (morningFull && afternoonFull) return "마감";
  if (morningFull) return "오전마감";
  if (afternoonFull) return "오후마감";
  return "";
}

function statusLabel(order: OrderResult | null) {
  if (!order) return "확인 중";
  if (order.payment?.status === "pending") return "입금 대기";
  return "확인 중";
}

function isPhotoOnlyOrderResult(order: OrderResult | null) {
  if (!order) return false;
  const productAmount = Number(order.totals?.productAmount ?? 0);
  const onlinePaymentAmount = Number(order.totals?.onlinePaymentAmount ?? 0);
  const selectedCount = Array.isArray(order.selected) ? order.selected.length : 0;
  return !order.transferUrl && productAmount === 0 && onlinePaymentAmount === 0 && selectedCount === 0;
}

function parseJsonSafely<T>(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function ReservationFlowClient({ step, initial }: ReservationFlowClientProps) {
  const router = useRouter();
  const initialRef = useRef(initial ?? EMPTY_INITIAL_DRAFT);
  const [draft, setDraft] = useState(() => defaultDraft(initialRef.current));
  const [draftReady, setDraftReady] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selections, setSelections] = useState<ProductSelection[]>([]);
  const [photos, setPhotos] = useState<ReservationPhoto[]>(() => reservationPhotoStore);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [slotDays, setSlotDays] = useState<Record<string, SlotDayInfo>>({});
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotError, setSlotError] = useState("");
  const base = useMemo(() => bookingMonthBase(), []);
  const [calendarMonth, setCalendarMonth] = useState(() => ({ year: base.year, month: base.month }));
  const totals = useMemo(() => productTotals(selections, draft.selfDisposal), [draft.selfDisposal, selections]);
  const categoryTitleByService = useMemo(() => Object.fromEntries(BUILDUSCARE_CATEGORIES.map((item) => [item.serviceCode, item.title])), []);
  const estimateCategory = useMemo(() => {
    const serviceCode = selections[0]?.product.serviceCode;
    return findBuilduscareCategoryByService(serviceCode ?? "") ?? BUILDUSCARE_CATEGORIES[0];
  }, [selections]);
  const canGoSchedule =
    selections.length > 0 &&
    draft.customerName.trim().length > 0 &&
    digits(draft.phone).length >= 10 &&
    draft.roadAddress.trim().length > 0 &&
    draft.detailAddress.trim().length > 0 &&
    draft.regionConfirmed &&
    draft.specConfirmed &&
    draft.privacyAccepted;
  const canGoConfirm = Boolean(draft.date && draft.time && slotAvailable(slotDays[draft.date], draft.time));
  const canGoPreviousCalendarMonth =
    calendarMonth.year > base.year ||
    (calendarMonth.year === base.year && calendarMonth.month > base.month);
  const needsReservationInfo = draftReady && step !== "info" && step !== "complete" && !canGoSchedule;
  const needsReservationSchedule = draftReady && step === "confirm" && canGoSchedule && !canGoConfirm;
  const blockedByPreviousStep = needsReservationInfo || needsReservationSchedule;
  const standaloneCompleteFallback =
    step === "complete" &&
    !orderResult?.orderNumber &&
    !draft.orderNumber &&
    selections.length === 0 &&
    !draft.customerName.trim() &&
    !draft.roadAddress.trim() &&
    photos.length === 0;
  const photoCheckComplete =
    step === "complete" &&
    Boolean(orderResult?.orderNumber) &&
    selections.length === 0 &&
    !orderResult?.transferUrl &&
    Number(orderResult?.totals?.onlinePaymentAmount ?? 0) === 0 &&
    Number(orderResult?.totals?.productAmount ?? 0) === 0 &&
    Boolean(orderResult?.item || orderResult?.itemLabel || orderResult?.photoCount !== undefined);
  const completeDepositAmount = Number(
    orderResult?.totals?.totalAmount ??
    orderResult?.totals?.onlinePaymentAmount ??
    0
  );
  const completeOrderNumber =
    orderResult?.orderNumber ||
    draft.orderNumber ||
    (standaloneCompleteFallback ? standaloneFallbackOrderNumber() : "확인 중");
  const completeItemTitle = standaloneCompleteFallback
    ? "수전 교체 · 사진 0장"
    : photoCheckComplete
      ? `${orderResult?.item || orderResult?.itemLabel || "사진 확인"} · ${donePhotoLabel(orderResult?.photoCount ?? photos.length)}`
      : `${orderItemLabel(selections)} · ${donePhotoLabel(orderResult?.photoCount ?? photos.length)}`;
  const completeItemMeta = standaloneCompleteFallback || photoCheckComplete
    ? "· 확인 중"
    : `${draft.roadAddress || "주소 확인 중"} · ${statusLabel(orderResult)}`;

  useEffect(() => {
    if (reservationPhotoStore.length > 0) {
      setPhotos(reservationPhotoStore);
      return;
    }
    const restored = restoreReservationPhotosFromSession();
    if (restored.length === 0) return;
    reservationPhotoStore = restored;
    setPhotos(restored);
  }, []);

  useEffect(() => {
    const stored = parseJsonSafely<Partial<ReservationDraft>>(window.localStorage.getItem(STORAGE_KEY)) ?? {};
    const prefs = parseJsonSafely<Partial<ReservationDraft>>(readClientStorage(PRODUCT_ORDER_PREFS_STORAGE_KEY, PRODUCT_ORDER_PREFS_COOKIE_KEY)) ?? {};
    const restoredResult = parseJsonSafely<OrderResult>(window.localStorage.getItem(ORDER_RESULT_STORAGE_KEY));
    const lastOrderNumber = window.localStorage.getItem("builduscare:lastOrderNumber") ?? "";
    const lastCustomerName = window.localStorage.getItem("builduscare:lastCustomerName") ?? "";
    const initialValues = initialRef.current;

    if (restoredResult?.orderNumber) {
      setOrderResult(restoredResult);
    }

    const storedSelections = restoreSelections();
    const resultSelections = restoreSelectionsFromOrderResult(restoredResult);
    if (step === "complete" && isPhotoOnlyOrderResult(restoredResult)) {
      setSelections([]);
    } else {
      setSelections(step === "complete" && resultSelections.length > 0 ? resultSelections : storedSelections);
    }

    setDraft(defaultDraft({
      ...stored,
      ...prefs,
      orderId: initialValues.orderId || stored.orderId,
      orderNumber: initialValues.orderNumber || stored.orderNumber || restoredResult?.orderNumber || lastOrderNumber,
      customerName: initialValues.customerName || stored.customerName || restoredResult?.customerName || lastCustomerName,
      phone: initialValues.phone || stored.phone
    }));
    setDraftReady(true);
  }, [step]);

  useEffect(() => {
    if (!draftReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // localStorage can be unavailable in private contexts.
    }
  }, [draft, draftReady]);

  useEffect(() => {
    if (step !== "schedule") return;
    const controller = new AbortController();
    async function loadSlots() {
      setSlotLoading(true);
      setSlotError("");
      try {
        const response = await fetch(`/api/slots?year=${calendarMonth.year}&month=${calendarMonth.month + 1}&fresh=1`, {
          cache: "no-store",
          signal: controller.signal
        });
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok) throw new Error("slot fetch failed");
        const days = json.data?.days ?? {};
        setSlotDays(days);
        setDraft((current) => {
          if (!current.date) return current;
          const day = days[current.date] as SlotDayInfo | undefined;
          if (dayFull(day)) return { ...current, date: "", time: "" };
          if (current.time && !slotAvailable(day, current.time)) return { ...current, time: "" };
          return current;
        });
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setSlotError("예약 가능 시간을 불러오지 못했어요. 잠시 후 다시 확인해주세요.");
      } finally {
        if (!controller.signal.aborted) setSlotLoading(false);
      }
    }
    void loadSlots();
    return () => controller.abort();
  }, [calendarMonth.month, calendarMonth.year, step]);

  function update<K extends keyof ReservationDraft>(key: K, value: ReservationDraft[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "cashReceiptType" && value === "none") next.cashReceiptIdentity = "";
      if (key === "cashReceiptType" && value === "personal" && !next.cashReceiptIdentity) next.cashReceiptIdentity = digits(next.phone);
      return next;
    });
  }

  function handleAddressSelect(address: AddressSelection) {
    setDraft((current) => ({
      ...current,
      roadAddress: address.road_address,
      postalCode: address.postal_code,
      detailAddress: ""
    }));
  }

  async function updatePhotos(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    const optimizedFiles = await Promise.all(files.map((file) => optimizePhotoFile(file)));
    setPhotos((current) => {
      const remaining = Math.max(0, 3 - current.length);
      const nextEntries = optimizedFiles.slice(0, remaining).map((file) => ({ file, url: URL.createObjectURL(file) }));
      if (!nextEntries.length) return current;
      const next = [...current, ...nextEntries];
      reservationPhotoStore = next;
      void persistReservationPhotosToSession(next);
      return next;
    });
  }

  function removePhoto(index: number) {
    const next = photos.filter((_, photoIndex) => photoIndex !== index);
    photos[index] && URL.revokeObjectURL(photos[index].url);
    reservationPhotoStore = next;
    void persistReservationPhotosToSession(next);
    setPhotos(next);
  }

  function selectDate(dateText: string) {
    const info = slotDays[dateText];
    setDraft((current) => ({
      ...current,
      date: dateText,
      time: current.time && slotAvailable(info, current.time) ? current.time : ""
    }));
  }

  function previousMonth() {
    if (!canGoPreviousCalendarMonth) return;
    setCalendarMonth((current) => {
      const date = new Date(current.year, current.month - 1, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  function nextMonth() {
    setCalendarMonth((current) => {
      const date = new Date(current.year, current.month + 1, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  async function submitOrder() {
    setError("");
    setMessage("");
    if (!canGoConfirm) {
      setError("방문 날짜와 시간대를 선택해주세요.");
      return;
    }
    if (!canGoSchedule) {
      setError("예약 정보와 필수 확인 항목을 다시 확인해주세요.");
      router.push("/reservation/info");
      return;
    }
    if (!cashReceiptOk(draft)) {
      setError("현금영수증 발급 정보를 확인해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("payload", JSON.stringify({
        deviceType: window.innerWidth <= 760 ? "mobile" : "desktop",
        item: orderItemLabel(selections),
        customer: { name: draft.customerName.trim(), phone: draft.phone.trim() },
        address: {
          roadAddress: draft.roadAddress.trim(),
          detailAddress: draft.detailAddress.trim(),
          postalCode: draft.postalCode
        },
        reservation: { date: draft.date, time: draft.time },
        selected: selections.map((item) => ({
          id: item.product.id,
          qty: item.qty,
          selectedColor: item.selectedColor
        })),
        selfDisposal: draft.selfDisposal,
        totals: {
          productAmount: totals.productAmount,
          laborAmount: totals.laborAmount,
          shippingAmount: totals.shippingAmount,
          disposalAmount: totals.disposalAmount,
          totalAmount: totals.totalAmount
        },
        cashReceipt: {
          type: draft.cashReceiptType,
          identity: cashReceiptIdentity(draft)
        }
      }));
      await appendOptimizedPhotos(formData, photos.map((entry) => entry.file));
      const response = await fetch("/api/builduscare/orders", { method: "POST", body: formData });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? json?.message ?? "접수 저장에 실패했어요.");
      }
      const order = json.data?.order as OrderResult | undefined;
      if (!order?.orderNumber) throw new Error("접수번호를 받지 못했어요.");
      window.localStorage.setItem("builduscare:lastOrderNumber", order.orderNumber);
      window.localStorage.setItem("builduscare:lastCustomerName", draft.customerName.trim());
      window.localStorage.setItem(ORDER_RESULT_STORAGE_KEY, JSON.stringify(order));
      reservationPhotoStore.forEach((photo) => URL.revokeObjectURL(photo.url));
      reservationPhotoStore = [];
      clearReservationPhotosFromSession();
      setOrderResult(order);
      setMessage("주문이 접수됐어요.");
      router.push("/reservation/complete");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "접수 저장에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  function openEstimatePreview() {
    openEstimatePreviewWindow({
      categoryTitle: estimateCategory.title,
      selections,
      productAmount: totals.productAmount,
      laborAmount: totals.laborAmount,
      shippingAmount: totals.shippingAmount,
      disposalAmount: totals.disposalAmount,
      totalAmount: totals.totalAmount,
      selfDisposal: draft.selfDisposal,
      categoryTitleByService,
      orderNumber: orderResult?.orderNumber || draft.orderNumber,
      customerName: orderResult?.customerName || draft.customerName,
      customerPhone: draft.phone,
      addressText: [draft.roadAddress, draft.detailAddress].filter(Boolean).join(" "),
      visitText: draft.date ? `${new Date(draft.date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}${draft.time ? ` · ${draft.time === "afternoon" ? "오후" : "오전"}` : ""}` : undefined,
      cashReceiptText: step === "confirm" || step === "complete" ? orderResult?.cashReceipt?.text ?? cashReceiptText(draft) : undefined,
      title: step === "confirm" || step === "complete" ? "최종 견적서" : "견적서"
    });
  }

  function renderCalendar() {
    const firstDay = new Date(calendarMonth.year, calendarMonth.month, 1).getDay();
    const daysInMonth = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate();
    const cells = Array.from({ length: firstDay }, (_, index) => <div key={`blank-${index}`} />);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(calendarMonth.year, calendarMonth.month, day);
      const iso = localIsoDate(date);
      const dayInfo = slotDays[iso];
      const isPrep = date < base.earliest;
      const isHoliday = isKoreanPublicHoliday(iso);
      const isClosed = isClosedReservationDate(iso) || Boolean(dayInfo?.blocked);
      const isFull = dayFull(dayInfo);
      const off = isPrep || isClosed || isFull || dayInfo?.beforeMinDate;
      const tag = dayTag(dayInfo, isClosed);
      const className = [
        "cal-d",
        date.getDay() === 0 ? "sun" : "",
        date.getDay() === 6 ? "sat" : "",
        isHoliday ? "holiday" : "",
        off ? "dim" : "",
        draft.date === iso ? "on" : ""
      ].filter(Boolean).join(" ");
      cells.push(
        <button key={iso} type="button" className={className} disabled={Boolean(off)} onClick={() => selectDate(iso)}>
          {day}
          {tag && <span className="cd-tag">{tag}</span>}
        </button>
      );
    }
    return cells;
  }

  return (
    <main className={`bc-page reservation-page reservation-step-${step}${standaloneCompleteFallback ? " reservation-complete-standalone" : ""}`}>
      <MobileAppBar
        title={step === "complete" ? "접수 완료" : "예약"}
        backHref={step === "info" ? "/products" : step === "schedule" ? "/reservation/info" : "/reservation/schedule"}
        showBack={step !== "complete"}
      />
      <div className="wrap narrow">
        {!standaloneCompleteFallback && (
          <div className="stepline" aria-label="예약 단계">
            <span>제품 선택</span>
            <ChevronRight aria-hidden="true" />
            <span>사진 확인</span>
            <ChevronRight aria-hidden="true" />
            <span className={step === "info" || step === "schedule" ? "on" : ""}>예약</span>
            <ChevronRight aria-hidden="true" />
            <span className={step === "confirm" || step === "complete" ? "on" : ""}>접수</span>
          </div>
        )}

        {needsReservationInfo && (
          <section className="bcard pad" style={{ padding: 28, marginTop: 24 }}>
            <div className="row gap10">
              <span className="tile" style={{ width: 42, height: 42, background: "#EEF4FF", color: "var(--brand-600)" }}>
                <AlertCircle aria-hidden="true" style={{ width: 22, height: 22 }} />
              </span>
              <div className="grow">
                <h1 className="h-md" style={{ margin: 0 }}>예약 정보가 필요해요</h1>
                <p className="p-sm" style={{ marginTop: 6, color: "var(--gray-600)" }}>
                  제품, 연락처, 주소와 필수 확인 항목을 먼저 입력해야 다음 단계로 진행할 수 있어요.
                </p>
              </div>
            </div>
            <div className="row gap10" style={{ marginTop: 18 }}>
              <Link className="web-btn pri lg grow" href="/reservation/info">예약 정보 입력</Link>
              <Link className="web-btn sec lg" href="/products">제품 다시 보기</Link>
            </div>
          </section>
        )}

        {needsReservationSchedule && (
          <section className="bcard pad" style={{ padding: 28, marginTop: 24 }}>
            <div className="row gap10">
              <span className="tile" style={{ width: 42, height: 42, background: "#EEF4FF", color: "var(--brand-600)" }}>
                <CalendarCheck aria-hidden="true" style={{ width: 22, height: 22 }} />
              </span>
              <div className="grow">
                <h1 className="h-md" style={{ margin: 0 }}>예약 일정을 선택해 주세요</h1>
                <p className="p-sm" style={{ marginTop: 6, color: "var(--gray-600)" }}>
                  방문 날짜와 오전/오후 시간대를 선택하면 접수 확인으로 넘어갈 수 있어요.
                </p>
              </div>
            </div>
            <Link className="web-btn pri lg block" style={{ marginTop: 18 }} href="/reservation/schedule">예약 일정 선택</Link>
          </section>
        )}

        {!blockedByPreviousStep && step === "info" && (
          <>
            <h1 className="p-sm strong" style={{ margin: "14px 0 6px", color: "var(--gray-900)" }}>예약정보를 적어주세요</h1>
            <p className="web-lede" style={{ fontSize: 16 }}>예약에 필요한 정보를 입력해 주세요. 사진은 선택사항이에요.</p>
            <section className="bcard pad" style={{ padding: 24, marginTop: 24 }}>
              <input
                id="reservation-photo-input"
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => {
                  void updatePhotos(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
              <div className="between">
                <div className="p-sm strong" style={{ color: "var(--gray-700)" }}>
                  {photos.length} / 3장 <span style={{ color: "var(--gray-400)", fontWeight: 500 }}>· 선택</span>
                </div>
                <div className="dots">{[0, 1, 2].map((index) => <i key={index} className={index < photos.length ? "on" : ""} />)}</div>
              </div>
              <div className="slots" style={{ marginTop: 14 }}>
                {["전체", "문제부위", "규격·연결부"].map((label, index) => {
                  const photo = photos[index];
                  return photo ? (
                    <div key={label} className="slot filled has-photo" style={{ aspectRatio: "1" }}>
                      <img src={photo.url} alt={label} />
                      <button type="button" className="slot-remove" onClick={() => removePhoto(index)} aria-label="사진 삭제">
                        <X aria-hidden="true" />
                      </button>
                      <span className="ph-tag">{label}</span>
                      <span className="slot-name">{photo.file.name}</span>
                      <span className="ph-check"><Check aria-hidden="true" /></span>
                    </div>
                  ) : (
                    <label key={label} className="slot" style={{ aspectRatio: "1", opacity: index <= photos.length ? 1 : 0.55 }} htmlFor="reservation-photo-input">
                      <Plus className="sl-ic" aria-hidden="true" />
                      <span className="sl-t">{label}</span>
                    </label>
                  );
                })}
              </div>
              <div className="note info" style={{ marginTop: 16 }}><Info aria-hidden="true" /><div>규격·연결부 사진이 있으면 <b>더욱 정확한 확인</b>이 가능해요.</div></div>
              <a className="web-btn kkbtn" style={{ marginTop: 6 }} href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" style={{ width: 18, height: 18 }} /> 잘 모르겠어요 · 카카오톡</a>
            </section>

            <section className="bcard pad" style={{ padding: 24, marginTop: 18 }}>
              <div className="h-md">연락 받을 정보</div>
              <div className="field" style={{ marginTop: 14 }}>
                <label>시공 받을 지역</label>
                <button type="button" className={`input addr-trigger${draft.roadAddress ? "" : " empty"}`} onClick={() => setAddressOpen(true)}>
                  <span className="addr-trigger-txt">{draft.roadAddress || "주소 검색"}</span>
                  <Search aria-hidden="true" />
                </button>
                {draft.postalCode && <div className="addr-postal">우편번호 {draft.postalCode}</div>}
                {draft.roadAddress && <input className="input addr-detail" placeholder="상세 주소 (동·호수)" value={draft.detailAddress} onChange={(event) => update("detailAddress", event.target.value)} />}
              </div>
              <div className="row gap16" style={{ marginTop: 14, alignItems: "flex-start" }}>
                <div className="field grow"><label>성함</label><input className="input" value={draft.customerName} onChange={(event) => update("customerName", event.target.value)} placeholder="홍길동" /></div>
                <div className="field grow"><label>연락 받을 번호</label><input className="input" value={draft.phone} onChange={(event) => update("phone", event.target.value)} placeholder="010-0000-0000" inputMode="tel" /></div>
              </div>
              <div className="note info" style={{ marginTop: 14 }}><Info aria-hidden="true" /><div>이 번호로 사진 확인 결과와 예상 견적을 안내드려요.</div></div>
              <div className="note region" style={{ marginTop: 10 }}><MapPin aria-hidden="true" /><div><b>예약 가능 지역</b> · 수원 · 성남(분당구) · 용인 · 의왕 · 군포 · 화성(동탄)<span className="region-soon">추후 확장 예정</span></div></div>
              <label className="disp-opt region-check">
                <input type="checkbox" checked={draft.regionConfirmed} onChange={(event) => update("regionConfirmed", event.target.checked)} />
                <span className="disp-box"></span>
                <span className="disp-txt">우리 집이 예약 가능 지역이 맞나요? <span className="disp-sub">위 지역에 해당해야 예약을 진행할 수 있어요. 맞으면 체크해 주세요.</span></span>
              </label>
              <label className="disp-opt region-check" style={{ marginTop: 12 }}>
                <input type="checkbox" checked={draft.specConfirmed} onChange={(event) => update("specConfirmed", event.target.checked)} />
                <span className="disp-box"></span>
                <span className="disp-txt">교체할 제품과 기존 설치되어 있는 제품·규격을 확인하셨나요? <span className="disp-sub">현장 규격과 다르면 설치가 어려울 수 있어요. 확인하셨다면 체크해 주세요.</span></span>
              </label>
              <label className="disp-opt region-check" style={{ marginTop: 12 }}>
                <input type="checkbox" checked={draft.privacyAccepted} onChange={(event) => update("privacyAccepted", event.target.checked)} />
                <span className="disp-box"></span>
                <span className="disp-txt">개인정보 수집·이용에 동의합니다 <Link href="/privacy" style={{ color: "#245FFF", fontWeight: 600 }} target="_blank">(보기)</Link> <span className="disp-sub">예약·연락 목적으로 이름·연락처·주소를 수집하며, 목적 달성 후 파기합니다.</span></span>
              </label>
            </section>
            <Link id="upNext" className={`web-btn pri lg block${canGoSchedule ? "" : " disabled"}`} style={{ marginTop: 20 }} href={canGoSchedule ? "/reservation/schedule" : "#"} aria-disabled={canGoSchedule ? "false" : "true"}>다음 · 예약 일정 선택</Link>
          </>
        )}

        {!blockedByPreviousStep && step === "schedule" && (
          <>
            <h1 className="web-h2" style={{ margin: "14px 0 6px" }}>예약 일정 선택</h1>
            <p className="web-lede" style={{ fontSize: 16 }}>제품 준비기간으로 <b style={{ color: "#1d1d1f" }}>영업일 기준 4일 이후부터</b> 예약할 수 있어요. 토요일·일요일과 공휴일은 휴무입니다.</p>
            <section className="bcard pad" style={{ padding: 24, marginTop: 22 }}>
              <div className="between reservation-calendar-head" style={{ marginBottom: 12 }}>
                <button className="web-btn sec month-nav-btn" type="button" onClick={previousMonth} disabled={!canGoPreviousCalendarMonth}><ChevronLeft aria-hidden="true" size={18} /> 이전</button>
                <div className="h-md">{calendarMonth.year}년 {calendarMonth.month + 1}월</div>
                <button className="web-btn sec month-nav-btn" type="button" onClick={nextMonth}>다음 <ChevronRight aria-hidden="true" size={18} /></button>
              </div>
              <div className="calendar">
                {DATE_WEEKDAYS.map((weekday, index) => <div key={weekday} className={`cal-hd${index === 0 ? " sun" : index === 6 ? " sat" : ""}`}>{weekday}</div>)}
                {renderCalendar()}
              </div>
              <div className="cal-legend"><span><i className="lg-dot off"></i> 토요일·일요일·공휴일 휴무</span><span><i className="lg-dot work"></i> 선택 가능한 평일</span></div>
              {slotError && <div className="note" style={{ marginTop: 12, background: "#FDECEC", color: "#B42318" }}><AlertCircle aria-hidden="true" /><div>{slotError}</div></div>}
            </section>

            <section className="bcard pad" style={{ padding: 24, marginTop: 18 }}>
              <div className="h-md">시간대</div>
              <div className="chips" style={{ marginTop: 12 }}>
                {([
                  ["morning", "오전 · 9시–12시"],
                  ["afternoon", "오후 · 1시–4시"]
                ] as const).map(([period, label]) => {
                  const unavailable = Boolean(draft.date && !slotAvailable(slotDays[draft.date], period));
                  return (
                    <button
                      key={period}
                      type="button"
                      className={`chip${draft.time === period ? " on" : ""}${unavailable ? " disabled" : ""}`}
                      disabled={unavailable}
                      onClick={() => update("time", period)}
                    >
                      {label}{unavailable ? " · 마감" : ""}
                    </button>
                  );
                })}
              </div>
              <div className="note" style={{ marginTop: 14 }}><Info aria-hidden="true" /><div>제품 교체 개수나 항목에 따라 시간이 더 걸릴 수 있습니다.</div></div>
            </section>
            {error && <div className="note" style={{ marginTop: 14, background: "#FDECEC", color: "#B42318", display: "flex", gap: 9, padding: "13px 15px", borderRadius: 14, fontSize: 13 }}><AlertCircle aria-hidden="true" style={{ width: 18, height: 18, flex: "none" }} /><div>{error}</div></div>}
            <Link className={`web-btn pri lg block${canGoConfirm ? "" : " disabled"}`} style={{ marginTop: 20 }} href={canGoConfirm ? "/reservation/confirm" : "#"} aria-disabled={canGoConfirm ? "false" : "true"}>{canGoConfirm ? "다음 · 접수 확인" : "날짜·시간을 골라주세요"}</Link>
          </>
        )}

        {!blockedByPreviousStep && step === "confirm" && (
          <>
            <h1 className="web-h2" style={{ margin: "14px 0 18px" }}>접수 확인</h1>
            <section className="bcard pad" style={{ padding: 24 }}>
              <div className="h-md">신청 내용</div>
              <div className="col gap10" style={{ marginTop: 12 }}>
                <div className="between"><span className="p-sm" style={{ color: "var(--gray-600)" }}>품목</span><span className="strong">{Array.from(new Set(selections.map((item) => productCategoryTitle(item.product)))).join(" · ") || "제품"}</span></div>
                <div className="between"><span className="p-sm" style={{ color: "var(--gray-600)" }}>제품</span><span className="strong">{selections.length}종 · 총 {totals.units}개</span></div>
                <div className="between"><span className="p-sm" style={{ color: "var(--gray-600)" }}>희망 예약</span><span className="strong">{dateLabel(draft.date)} · {slotLabel(draft.time)}</span></div>
                <div className="between"><span className="p-sm" style={{ color: "var(--gray-600)" }}>사진</span><span className="strong">{photoLabel(photos.length)}</span></div>
              </div>
              <div className="divline" style={{ margin: "16px 0" }}></div>
              <div className="col gap10">
                <div className="between"><span className="p-sm" style={{ color: "var(--gray-600)" }}><Package style={{ width: 15, height: 15, verticalAlign: "-2px" }} /> 제품비 <span style={{ color: "var(--gray-400)" }}>총 {totals.units}개</span></span><span className="strong">{formatKRW(totals.productAmount)}</span></div>
                <div className="between"><span className="p-sm" style={{ color: "var(--gray-600)" }}><Wrench style={{ width: 15, height: 15, verticalAlign: "-2px" }} /> 시공비 <span style={{ color: "var(--gray-400)" }}>×{totals.units}</span></span><span className="strong">{formatKRW(totals.laborAmount)}</span></div>
                <div className="between"><span className="p-sm" style={{ color: "var(--gray-600)" }}><Package style={{ width: 15, height: 15, verticalAlign: "-2px" }} /> 배송비</span><span className="strong">{formatKRW(totals.shippingAmount)}</span></div>
                <div className="between"><span className="p-sm" style={{ color: "var(--gray-600)" }}><Trash2 style={{ width: 15, height: 15, verticalAlign: "-2px" }} /> 폐기물처리비 <span style={{ color: "var(--gray-400)" }}>×{totals.units}</span></span><span className="strong">{formatKRW(totals.disposalAmount)}</span></div>
                <label className="disp-opt" style={{ marginTop: 4 }}>
                  <input type="checkbox" checked={draft.selfDisposal} onChange={(event) => update("selfDisposal", event.target.checked)} />
                  <span className="disp-box"></span>
                  <span className="disp-txt">폐기물은 직접 처리할게요 <span className="disp-sub">직접 처리 시 폐기물 처리비 제외</span></span>
                </label>
                <div className="prow tot" style={{ marginTop: 4 }}><span className="pk">최종 합계</span><span className="pv">{formatKRW(totals.totalAmount).replace(/원$/, "")}<span className="sub" style={{ fontWeight: 600 }}> 원</span></span></div>
              </div>
            </section>

            <section className="bcard pad" style={{ padding: 24, marginTop: 16 }}>
              <div className="h-md">현금영수증</div>
              <p className="p-sm" style={{ marginTop: 6, color: "var(--gray-600)" }}>{draft.cashReceiptType === "none" ? "현금영수증이 필요하면 용도를 선택해 주세요." : "입금 확인 후 아래 정보로 현금영수증 발급을 진행합니다."}</p>
              <div className="chips" style={{ marginTop: 12 }}>
                <button className={`chip${draft.cashReceiptType === "none" ? " on" : ""}`} type="button" onClick={() => update("cashReceiptType", "none")}>발급 안 함</button>
                <button className={`chip${draft.cashReceiptType === "personal" ? " on" : ""}`} type="button" onClick={() => update("cashReceiptType", "personal")}>소득공제용</button>
                <button className={`chip${draft.cashReceiptType === "business" ? " on" : ""}`} type="button" onClick={() => update("cashReceiptType", "business")}>지출증빙용</button>
              </div>
              {draft.cashReceiptType !== "none" && (
                <div className="field" style={{ marginTop: 14 }}>
                  <label>{draft.cashReceiptType === "business" ? "사업자등록번호" : "휴대전화번호"}</label>
                  <input className="input" inputMode="numeric" autoComplete="off" placeholder={draft.cashReceiptType === "business" ? "사업자등록번호 10자리" : "01000000000"} value={cashReceiptIdentity(draft)} onChange={(event) => update("cashReceiptIdentity", event.target.value)} />
                </div>
              )}
            </section>

            <div className="note info" style={{ marginTop: 16 }}><ShieldCheck aria-hidden="true" /><div><b>추가 비용은 없어요.</b> 출장비도 받지 않아요. 사진과 현장이 같다면 위 금액 그대로 진행됩니다.</div></div>
            <div className="note" style={{ marginTop: 10, background: "rgba(120,120,128,.08)", color: "var(--gray-600)", display: "flex", gap: 9, padding: "13px 15px", borderRadius: 14, fontSize: 13 }}><Info aria-hidden="true" style={{ width: 18, height: 18, flex: "none", color: "var(--gray-500)" }} /><div>기존 제품을 <b>직접 처리하시면 폐기물처리비가 제외</b>돼요.</div></div>
            {error && <div className="note" style={{ marginTop: 14, background: "#FDECEC", color: "#B42318", display: "flex", gap: 9, padding: "13px 15px", borderRadius: 14, fontSize: 13 }}><AlertCircle aria-hidden="true" style={{ width: 18, height: 18, flex: "none" }} /><div>{error}</div></div>}
            <button className="web-btn pri lg block" style={{ marginTop: 20 }} aria-disabled={submitting ? "true" : "false"} type="button" disabled={submitting} onClick={submitOrder}>{submitting ? "접수 저장 중..." : "주문 접수하기"}</button>
            <button className="web-btn sec lg block" style={{ marginTop: 10 }} type="button" onClick={openEstimatePreview}>
              <FileText aria-hidden="true" style={{ width: 18, height: 18 }} /> 최종 견적서 보기
            </button>
          </>
        )}

        {!blockedByPreviousStep && step === "complete" && (
          <section className="reservation-complete-view" style={{ textAlign: "center" }}>
            <div className="featured-icon circle" style={{ width: 76, height: 76, background: "var(--success-50)", color: "var(--success-600)", margin: "24px auto 0" }}>
              <Check aria-hidden="true" style={{ width: 38, height: 38 }} />
            </div>
            <h1 className="web-h2" style={{ marginTop: 18 }}>신청이 접수됐어요</h1>
            <p className="web-lede" style={{ fontSize: 16, marginTop: 8 }}>
              {standaloneCompleteFallback
                ? "영업시간 기준 2시간 내 견적을 카카오톡으로 안내해 드릴게요."
                : photoCheckComplete
                ? "영업시간 기준 2시간 내 견적을 카카오톡으로 안내해 드릴게요."
                : orderResult?.transferUrl
                  ? "입금 확인 후 기사 배정과 방문 일정을 안내해 드릴게요."
                  : "주문 내용을 확인하고 방문 일정을 순차적으로 안내해 드릴게요."}
            </p>
            <div className="bcard pad" style={{ padding: 22, textAlign: "left", maxWidth: 440, margin: "22px auto 0" }}>
              <div className="between"><div className="p-sm strong" style={{ color: "var(--gray-700)" }}>접수번호</div><div className="p-sm strong">{completeOrderNumber}</div></div>
              <div className="between" style={{ marginTop: 8 }}><div className="p-sm strong" style={{ color: "var(--gray-700)" }}>현재 상태</div><span className="badge badge-warning dot">{statusLabel(orderResult)}</span></div>
              {completeDepositAmount > 0 && (
                <div className="between" style={{ marginTop: 10, alignItems: "baseline" }}>
                  <div className="p-sm strong" style={{ color: "var(--gray-700)" }}>입금 금액</div>
                  <div className="strong" style={{ color: "var(--brand-600)", fontSize: 18, lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>
                    {formatKRW(completeDepositAmount)}
                  </div>
                </div>
              )}
              <div className="divline" style={{ margin: "12px 0" }}></div>
              <div className="row gap10">
                <span className="tile" style={{ width: 38, height: 38 }}>
                  {standaloneCompleteFallback || photoCheckComplete ? <Droplets aria-hidden="true" style={{ width: 20, height: 20 }} /> : <Package aria-hidden="true" style={{ width: 20, height: 20 }} />}
                </span>
                <div className="grow">
                  <div className="p-sm strong" style={{ color: "var(--gray-900)" }}>{completeItemTitle}</div>
                  <div className="p-sm">{completeItemMeta}</div>
                </div>
              </div>
              {orderResult?.transferUrl && (
                <>
                  <div className="divline" style={{ margin: "14px 0" }}></div>
                  <div className="row gap10">
                    <span className="tile" style={{ width: 38, height: 38, background: "var(--brand-50)", color: "var(--brand-600)" }}><Wallet aria-hidden="true" style={{ width: 20, height: 20 }} /></span>
                    <div className="grow"><div className="p-sm strong" style={{ color: "var(--gray-900)" }}>계좌이체 안내</div><div className="p-sm">입금 확인 후 주문이 진행돼요.</div></div>
                  </div>
                  <div className="col gap8" style={{ marginTop: 12 }}>
                    <div className="between"><span className="p-sm" style={{ color: "var(--gray-600)" }}>예금주</span><span className="p-sm strong" style={{ color: "var(--gray-900)" }}>주식회사 무니온</span></div>
                    <div className="between"><span className="p-sm" style={{ color: "var(--gray-600)" }}>입금 계좌</span><span className="p-sm strong" style={{ color: "var(--gray-900)" }}>농협 355-0094-9209-33</span></div>
                    <div className="between"><span className="p-sm" style={{ color: "var(--gray-600)" }}>입금자명</span><span className="p-sm strong" style={{ color: "var(--gray-900)" }}>{`${orderResult.customerName || draft.customerName || "예약자"} ${String(orderResult.orderNumber).split("-").pop() || ""}`.trim()}</span></div>
                  </div>
                </>
              )}
            </div>
            <div className="bc-desktop-only" style={{ display: "grid", gap: 10, maxWidth: 360, margin: "16px auto 0" }}>
              {selections.length > 0 && (
                <button className="web-btn sec lg block" type="button" onClick={openEstimatePreview}>
                  <FileText aria-hidden="true" style={{ width: 18, height: 18 }} /> 최종 견적서 보기
                </button>
              )}
              <a className="web-btn kkbtn lg block" href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" style={{ width: 18, height: 18 }} /> 카카오톡으로 결과 알림 받기</a>
              {!standaloneCompleteFallback && !photoCheckComplete && (orderResult?.orderNumber || draft.orderNumber) && (
                <Link className="web-btn pri lg block" href={`/order-lookup${orderResult?.orderNumber || draft.orderNumber ? `?orderNumber=${encodeURIComponent(orderResult?.orderNumber || draft.orderNumber)}&name=${encodeURIComponent(orderResult?.customerName || draft.customerName)}` : ""}`}>주문 현황 보기</Link>
              )}
              <Link className="web-btn sec lg block" href="/">홈으로</Link>
            </div>
            <div className="bc-mobile-only reservation-complete-mobile-actions">
              <a className="reservation-complete-kakao-card" href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer">
                <span className="reservation-complete-kakao-icon"><MessageCircle aria-hidden="true" style={{ width: 20, height: 20 }} /></span>
                <span className="reservation-complete-kakao-copy">
                  <b>카카오톡으로 결과 알림 받기</b>
                  <small>추가 질문도 톡으로 편하게</small>
                </span>
                <ChevronRight aria-hidden="true" style={{ width: 18, height: 18 }} />
              </a>
              {!standaloneCompleteFallback && !photoCheckComplete && (orderResult?.orderNumber || draft.orderNumber) && (
                <Link className="web-btn sec lg block" href={`/order-lookup${orderResult?.orderNumber || draft.orderNumber ? `?orderNumber=${encodeURIComponent(orderResult?.orderNumber || draft.orderNumber)}&name=${encodeURIComponent(orderResult?.customerName || draft.customerName)}` : ""}`}>주문 현황 보기</Link>
              )}
              <div className="reservation-complete-mobile-home">
                <Link className="web-btn pri lg block" href="/">홈으로</Link>
              </div>
            </div>
            {message && <p className="p-sm" style={{ marginTop: 12, color: "var(--gray-500)" }}>{message}</p>}
          </section>
        )}
      </div>
      <AddressModal open={addressOpen} onClose={() => setAddressOpen(false)} onSelect={handleAddressSelect} />
    </main>
  );
}
