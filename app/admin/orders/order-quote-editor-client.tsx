"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatKRW } from "@/lib/format";
import { PRODUCT_DISPOSAL_FEE } from "@/components/builduscare/product-helpers";
import { openQuoteDocumentPreviewWindow, type QuoteDocumentInput } from "@/lib/quote-document";
import { quoteSubtotalAmount, quoteVatIncludedAmount } from "@/lib/quote-totals";

type QuoteCatalogProduct = {
  id: string;
  label: string;
  sku: string;
  image?: string;
  price: number;
  laborPrice: number;
  categoryName: string;
};

type QuoteCatalogGroup = {
  id: string;
  name: string;
  products: QuoteCatalogProduct[];
};

type QuoteCatalog = {
  serviceCode: string;
  label: string;
  groups: QuoteCatalogGroup[];
};

type QuoteDraftItem = {
  serviceTypeCode: string;
  productId: string;
  qty: number;
};

type LocalQuoteDraft = {
  id?: string;
  customerName?: string;
  customerPhone?: string;
  addressText?: string;
  items?: Array<{
    service_type_code?: string;
    product_id?: string;
    qty?: number;
  }>;
  visitFee?: number;
  discount?: number;
  selfDisposal?: boolean;
  scheduleDate?: string;
  scheduleTime?: SlotPeriod | "";
};

type SlotPeriod = "morning" | "afternoon";

type SlotDayInfo = {
  date: string;
  blocked: boolean;
  beforeMinDate: boolean;
  allFull: boolean;
  slots: Record<SlotPeriod, { available: boolean; isFull?: boolean; usedCount?: number; maxCount?: number; used?: number; cap?: number }>;
};

const DATE_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Props = {
  orderId?: string | null;
  manualQuoteId?: string | null;
  orderNumber?: string | null;
  catalogs: QuoteCatalog[];
  initialItems: QuoteDraftItem[];
  initialVisitFee: number;
  initialDiscount: number;
  initialScheduleDate?: string | null;
  initialScheduleTime?: SlotPeriod | null;
  initialServiceCode: string;
  currentQuoteVersion?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  addressText?: string | null;
  editableCustomerFields?: boolean;
  localMode?: boolean;
};

function normalizeQty(value: number) {
  return Math.max(1, Number.isFinite(value) ? Math.floor(value) : 1);
}

function formatVisitTextForPreview() {
  return "방문일 확인 전";
}

function monthKey(date: Date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1
  };
}

function datePad(value: number) {
  return String(value).padStart(2, "0");
}

function localIsoDate(date: Date) {
  return `${date.getFullYear()}-${datePad(date.getMonth() + 1)}-${datePad(date.getDate())}`;
}

function monthFromDateText(dateText?: string | null) {
  if (dateText && /^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    const [year, month] = dateText.split("-").map(Number);
    return { year, month };
  }
  return monthKey(new Date());
}

function formatScheduleVisitText(dateText: string, slot: SlotPeriod | "") {
  if (!dateText || !slot) return formatVisitTextForPreview();
  return `${dateText} ${slot === "afternoon" ? "오후" : "오전"}`;
}

function slotLabel(slot: SlotPeriod) {
  return slot === "afternoon" ? "오후" : "오전";
}

function slotUsageLabel(slot: SlotDayInfo["slots"][SlotPeriod] | undefined, label: string) {
  if (!slot) return `${label} 확인 중`;
  if (slot.available === false || slot.isFull) return `${label} 마감`;
  const used = slot.usedCount ?? slot.used ?? 0;
  const max = slot.maxCount ?? slot.cap ?? 0;
  return `${label} ${Math.min(used, max)}/${max}`;
}

export function OrderQuoteEditor({
  orderId,
  manualQuoteId,
  orderNumber,
  catalogs,
  initialItems,
  initialVisitFee,
  initialDiscount,
  initialScheduleDate,
  initialScheduleTime,
  initialServiceCode,
  currentQuoteVersion,
  customerName,
  customerPhone,
  addressText,
  editableCustomerFields = false,
  localMode = false
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editingDraftId = !orderId && !manualQuoteId ? searchParams.get("draftId") : null;
  const serviceOptions = useMemo(
    () => catalogs.map((catalog) => ({ value: catalog.serviceCode, label: catalog.label })),
    [catalogs]
  );
  const defaultServiceCode = catalogs.some((catalog) => catalog.serviceCode === initialServiceCode)
    ? initialServiceCode
    : catalogs[0]?.serviceCode || "toilet_replace";
  const normalizedInitialItems = useMemo(
    () => initialItems.map((item) => {
      const exactCatalog = catalogs.find((catalog) => catalog.serviceCode === item.serviceTypeCode);
      const productCatalog = catalogs.find((catalog) =>
        catalog.groups.some((group) => group.products.some((product) => product.id === item.productId))
      );
      return {
        ...item,
        serviceTypeCode: exactCatalog?.serviceCode ?? productCatalog?.serviceCode ?? defaultServiceCode,
        qty: normalizeQty(item.qty)
      };
    }),
    [catalogs, defaultServiceCode, initialItems]
  );
  const [items, setItems] = useState<QuoteDraftItem[]>(normalizedInitialItems);
  const [builderServiceCode, setBuilderServiceCode] = useState(defaultServiceCode);
  const [builderProductId, setBuilderProductId] = useState("");
  const [builderQty, setBuilderQty] = useState(1);
  const [selfDisposal, setSelfDisposal] = useState(false);
  const discount = 0;
  const [scheduleDate, setScheduleDate] = useState(initialScheduleDate ?? "");
  const [scheduleTime, setScheduleTime] = useState<SlotPeriod | "">(initialScheduleTime ?? "");
  const [calendarMonth, setCalendarMonth] = useState(() => monthFromDateText(initialScheduleDate));
  const [slotDays, setSlotDays] = useState<Record<string, SlotDayInfo>>({});
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotMessage, setSlotMessage] = useState("");
  const [draftCustomerName, setDraftCustomerName] = useState(customerName ?? "");
  const [draftCustomerPhone, setDraftCustomerPhone] = useState(customerPhone ?? "");
  const [draftAddressText, setDraftAddressText] = useState(addressText ?? "");
  const [saving, setSaving] = useState<null | "save" | "download">(null);
  const [message, setMessage] = useState("");

  const catalogMap = useMemo(() => new Map(catalogs.map((catalog) => [catalog.serviceCode, catalog])), [catalogs]);
  const productMap = useMemo(() => {
    const map = new Map<string, QuoteCatalogProduct>();
    for (const catalog of catalogs) {
      for (const group of catalog.groups) {
        for (const product of group.products) {
          map.set(`${catalog.serviceCode}:${product.id}`, product);
        }
      }
    }
    return map;
  }, [catalogs]);

  const activeCatalog = catalogMap.get(builderServiceCode) ?? catalogs[0] ?? null;
  const activeProduct = builderProductId ? productMap.get(`${builderServiceCode}:${builderProductId}`) ?? null : null;

  useEffect(() => {
    if (!editingDraftId || orderId) return;

    try {
      const parsed = JSON.parse(window.localStorage.getItem("builduscare:adminQuoteDrafts") || "[]");
      const drafts: LocalQuoteDraft[] = Array.isArray(parsed) ? parsed : [];
      const draft = drafts.find((item) => item.id === editingDraftId);
      if (!draft) {
        setMessage("수정할 임시 견적을 찾지 못했습니다.");
        return;
      }

      const loadedItems = Array.isArray(draft.items)
        ? draft.items
            .map((item) => {
              const productId = String(item.product_id ?? "");
              const exactCatalog = catalogs.find((catalog) => catalog.serviceCode === item.service_type_code);
              const productCatalog = catalogs.find((catalog) =>
                catalog.groups.some((group) => group.products.some((product) => product.id === productId))
              );
              const serviceTypeCode = exactCatalog?.serviceCode ?? productCatalog?.serviceCode ?? defaultServiceCode;
              return {
                serviceTypeCode,
                productId,
                qty: normalizeQty(Number(item.qty ?? 1))
              };
            })
            .filter((item) => item.productId && productMap.has(`${item.serviceTypeCode}:${item.productId}`))
        : [];

      setDraftCustomerName(String(draft.customerName ?? ""));
      setDraftCustomerPhone(String(draft.customerPhone ?? ""));
      setDraftAddressText(String(draft.addressText ?? ""));
      setSelfDisposal(typeof draft.selfDisposal === "boolean" ? draft.selfDisposal : Number(draft.visitFee ?? 0) <= 0);
      setScheduleDate(String(draft.scheduleDate ?? ""));
      setScheduleTime(draft.scheduleTime === "morning" || draft.scheduleTime === "afternoon" ? draft.scheduleTime : "");
      setCalendarMonth(monthFromDateText(String(draft.scheduleDate ?? "")));
      setItems(loadedItems);
      setMessage("임시 견적을 불러왔습니다. 수정 후 저장하면 목록에 반영됩니다.");
    } catch {
      setMessage("임시 견적을 불러오지 못했습니다.");
    }
  }, [catalogs, defaultServiceCode, editingDraftId, orderId, productMap]);

  useEffect(() => {
    let cancelled = false;
    setSlotLoading(true);
    setSlotMessage("");

    fetch(`/api/slots?year=${calendarMonth.year}&month=${calendarMonth.month}&fresh=1`)
      .then((response) => response.json())
      .then((results) => {
        if (cancelled) return;
        setSlotDays(results?.data?.days ?? {});
      })
      .catch(() => {
        if (cancelled) return;
        setSlotMessage("일정관리 슬롯을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      })
      .finally(() => {
        if (!cancelled) setSlotLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [calendarMonth.month, calendarMonth.year]);

  const totalUnits = useMemo(() => items.reduce((sum, item) => sum + (item.productId ? normalizeQty(item.qty) : 0), 0), [items]);
  const visitFee = selfDisposal ? 0 : PRODUCT_DISPOSAL_FEE * totalUnits;

  const totals = useMemo(() => {
    const resolvedItems = items
      .map((item) => ({
        item,
        product: productMap.get(`${item.serviceTypeCode}:${item.productId}`) ?? null
      }))
      .filter((entry) => entry.product);

    const productTotal = resolvedItems.reduce((sum, entry) => sum + Number(entry.product?.price ?? 0) * entry.item.qty, 0);
    const laborTotal = resolvedItems.reduce((sum, entry) => sum + Number(entry.product?.laborPrice ?? 0) * entry.item.qty, 0);
    const subtotalTotal = quoteSubtotalAmount(productTotal, laborTotal, visitFee, discount);
    const finalTotal = quoteVatIncludedAmount(subtotalTotal);
    return { productTotal, laborTotal, subtotalTotal, finalTotal, resolvedItems };
  }, [discount, items, productMap, visitFee]);

  function buildQuoteDocumentInput(): QuoteDocumentInput | null {
    if (totals.resolvedItems.length === 0) return null;

    const rows = totals.resolvedItems.map(({ item, product }, index) => {
      if (!product) throw new Error("선택한 제품 정보를 찾을 수 없습니다.");
      const lineMaterial = product.price * item.qty;
      const lineLabor = product.laborPrice * item.qty;
      return {
        id: `${item.productId}-${index}`,
        image: product.image || null,
        productName: product.label,
        sku: product.sku,
        categoryLabel: product.categoryName,
        qty: item.qty,
        price: lineMaterial,
        labor: lineLabor,
        finalPrice: lineMaterial + lineLabor
      };
    });

    return {
      orderNumber: orderNumber || "임시 견적서",
      customerName: draftCustomerName.trim() || null,
      customerPhone: draftCustomerPhone.trim() || null,
      serviceName: totals.resolvedItems[0]?.item.serviceTypeCode ?? defaultServiceCode,
      rows,
      address: draftAddressText.trim() || "주소 확인 중",
      visitText: formatScheduleVisitText(scheduleDate, scheduleTime),
      productTotal: totals.productTotal,
      laborTotal: totals.laborTotal,
      subtotalTotal: totals.subtotalTotal,
      finalTotal: totals.finalTotal,
      transferAmount: totals.productTotal,
      onsiteAmount: Math.max(0, totals.laborTotal + visitFee),
      productCatalogMode: true,
      cashReceiptText: "미정"
    };
  }

  function previewQuoteDocument() {
    const input = buildQuoteDocumentInput();
    if (!input) {
      setMessage("미리볼 견적 항목을 먼저 추가해 주세요.");
      return;
    }
    openQuoteDocumentPreviewWindow(input);
    setMessage("");
  }

  function addCommittedItem() {
    if (!builderProductId) {
      setMessage("제품을 먼저 선택하세요.");
      return;
    }

    const nextQty = normalizeQty(builderQty);
    setItems((current) => {
      const existingIndex = current.findIndex(
        (item) => item.serviceTypeCode === builderServiceCode && item.productId === builderProductId
      );
      if (existingIndex >= 0) {
        return current.map((item, index) =>
          index === existingIndex ? { ...item, qty: item.qty + nextQty } : item
        );
      }
      return [...current, { serviceTypeCode: builderServiceCode, productId: builderProductId, qty: nextQty }];
    });
    setBuilderQty(1);
    setMessage("");
  }

  function previousMonth() {
    setCalendarMonth((current) => {
      const date = new Date(current.year, current.month - 2, 1);
      return { year: date.getFullYear(), month: date.getMonth() + 1 };
    });
  }

  function nextMonth() {
    setCalendarMonth((current) => {
      const date = new Date(current.year, current.month, 1);
      return { year: date.getFullYear(), month: date.getMonth() + 1 };
    });
  }

  function selectScheduleDate(dateText: string) {
    const dayInfo = slotDays[dateText];
    if (!dayInfo || dayInfo.blocked || dayInfo.beforeMinDate || dayInfo.allFull) return;
    setScheduleDate(dateText);
    if (scheduleTime && !dayInfo.slots[scheduleTime]?.available) {
      setScheduleTime("");
    }
  }

  function renderScheduleCalendar() {
    const firstDay = new Date(calendarMonth.year, calendarMonth.month - 1, 1).getDay();
    const daysInMonth = new Date(calendarMonth.year, calendarMonth.month, 0).getDate();
    const blanks = Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} className="adm-quote-calendar-blank" />);
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(calendarMonth.year, calendarMonth.month - 1, index + 1);
      const iso = localIsoDate(date);
      const dayInfo = slotDays[iso];
      const morning = dayInfo?.slots?.morning;
      const afternoon = dayInfo?.slots?.afternoon;
      const unavailable = !dayInfo || dayInfo.blocked || dayInfo.beforeMinDate || dayInfo.allFull || (!morning?.available && !afternoon?.available);
      const label = !dayInfo
        ? "확인 중"
        : dayInfo.beforeMinDate
          ? "준비 기간"
          : dayInfo.blocked
            ? "휴무"
            : dayInfo.allFull
              ? "마감"
              : `${slotUsageLabel(morning, "오전")} · ${slotUsageLabel(afternoon, "오후")}`;

      return (
        <button
          key={iso}
          type="button"
          className={[
            "adm-quote-calendar-day",
            date.getDay() === 0 ? "sun" : "",
            date.getDay() === 6 ? "sat" : "",
            scheduleDate === iso ? "selected" : "",
            unavailable ? "disabled" : ""
          ].filter(Boolean).join(" ")}
          onClick={() => selectScheduleDate(iso)}
          disabled={Boolean(saving) || unavailable}
        >
          <strong>{index + 1}</strong>
          <small>{label}</small>
        </button>
      );
    });
    return [...blanks, ...days];
  }

  function updateCommittedQty(index: number, qty: number) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, qty: normalizeQty(qty) } : item))
    );
  }

  function removeCommittedItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveToQuoteList() {
    window.setTimeout(() => {
      router.push("/admin/quotes/list");
      router.refresh();
    }, 550);
  }

  async function saveStandaloneDraft(downloadAfterSave: boolean) {
    const validItems = totals.resolvedItems
      .filter(({ item }) => item.productId)
      .map(({ item }) => ({
        service_type_code: item.serviceTypeCode,
        product_id: item.productId,
        qty: item.qty
      }));

    if (validItems.length === 0) {
      setMessage("견적에 담을 제품을 최소 1개 추가해 주세요.");
      return;
    }

    if (!draftCustomerName.trim() || !draftCustomerPhone.trim() || !draftAddressText.trim()) {
      setMessage("고객명, 연락처, 주소를 먼저 입력하세요.");
      return;
    }

    const quoteDocumentInput = buildQuoteDocumentInput();
    if (!quoteDocumentInput) {
      setMessage("견적에 담을 제품을 최소 1개 추가해 주세요.");
      return;
    }

    const draftId = editingDraftId || `standalone-${Date.now()}`;
    const draftPayload = {
      id: draftId,
      orderNumber: "임시 견적서",
      customerName: draftCustomerName.trim(),
      customerPhone: draftCustomerPhone.trim(),
      addressText: draftAddressText.trim(),
      summary: totals.resolvedItems
        .map(({ item, product }) => `${product?.label ?? "선택 제품"}${item.qty > 1 ? ` × ${item.qty}` : ""}`)
        .join(", "),
      items: validItems,
      visitFee,
      discount,
      selfDisposal,
      scheduleDate,
      scheduleTime,
      productTotal: totals.productTotal,
      laborTotal: totals.laborTotal,
      subtotalTotal: totals.subtotalTotal,
      finalTotal: totals.finalTotal,
      createdAt: new Date().toISOString()
    };

    const parsedExisting = JSON.parse(window.localStorage.getItem("builduscare:adminQuoteDrafts") || "[]");
    const existing = Array.isArray(parsedExisting) ? parsedExisting : [];
    const nextDrafts = existing.filter((draft) => draft?.id !== draftId);
    nextDrafts.unshift(draftPayload);
    window.localStorage.setItem("builduscare:adminQuoteDrafts", JSON.stringify(nextDrafts.slice(0, 20)));

    if (downloadAfterSave) {
      openQuoteDocumentPreviewWindow(quoteDocumentInput);
    }

    setMessage(
      downloadAfterSave
        ? `${editingDraftId ? "임시 견적을 수정하고" : "임시 견적을 저장하고"} 견적서를 열었습니다.`
        : editingDraftId
          ? "임시 견적을 수정했습니다."
          : "임시 견적을 저장했습니다."
    );
    moveToQuoteList();
  }

  async function saveManualQuote(downloadAfterSave: boolean, validItems: Array<{ service_type_code: string; product_id: string; qty: number }>) {
    if (!draftCustomerName.trim() || !draftCustomerPhone.trim() || !draftAddressText.trim()) {
      setMessage("고객명, 연락처, 주소를 먼저 입력하세요.");
      return;
    }

    const response = await fetch("/api/admin/manual-quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manual_quote_id: manualQuoteId || null,
        service_type_code: validItems[0]?.service_type_code ?? defaultServiceCode,
        customer_name: draftCustomerName.trim(),
        customer_phone: draftCustomerPhone.trim(),
        address_text: draftAddressText.trim(),
        visit_fee: visitFee,
        discount,
        schedule: scheduleDate && scheduleTime
          ? { reserved_date: scheduleDate, time_slot: scheduleTime }
          : null,
        items: validItems
      })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "수동 견적 저장에 실패했습니다.");
    }

    if (downloadAfterSave && payload?.data?.quoteDocumentInput) {
      openQuoteDocumentPreviewWindow(payload.data.quoteDocumentInput as QuoteDocumentInput);
    }

    setMessage(downloadAfterSave ? "수동 견적 저장 후 견적서를 열었습니다." : "수동 견적을 저장했습니다.");
    moveToQuoteList();
  }

  async function submit(downloadAfterSave: boolean) {
    const validItems = totals.resolvedItems
      .filter(({ item }) => item.productId)
      .map(({ item }) => ({
        service_type_code: item.serviceTypeCode,
        product_id: item.productId,
        qty: item.qty
      }));

    if (validItems.length === 0) {
      setMessage("견적에 담을 제품을 최소 1개 추가해 주세요.");
      return;
    }

    if (!orderId) {
      setSaving(downloadAfterSave ? "download" : "save");
      setMessage("");
      try {
        if (localMode) {
          await saveStandaloneDraft(downloadAfterSave);
        } else {
          await saveManualQuote(downloadAfterSave, validItems);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "수동 견적 저장에 실패했습니다.");
      } finally {
        setSaving(null);
      }
      return;
    }

    setSaving(downloadAfterSave ? "download" : "save");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_type_code: validItems[0]?.service_type_code ?? defaultServiceCode,
          customer_name: draftCustomerName.trim() || null,
          customer_phone: draftCustomerPhone.trim() || null,
          address_text: draftAddressText.trim() || null,
          visit_fee: visitFee,
          discount,
          schedule: scheduleDate && scheduleTime
            ? { reserved_date: scheduleDate, time_slot: scheduleTime }
            : null,
          items: validItems
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "견적서 저장에 실패했습니다.");
      }

      if (downloadAfterSave && payload?.data?.quoteDocumentInput) {
        openQuoteDocumentPreviewWindow(payload.data.quoteDocumentInput as QuoteDocumentInput);
      }

      setMessage(downloadAfterSave ? "견적 저장 후 견적서를 열었습니다." : "새 견적 버전을 저장했습니다.");
      moveToQuoteList();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "견적서 저장에 실패했습니다.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="adm-card adm-quote-editor">
      <div className="adm-section-head">
        <div>
          <h2 className="adm-card-title">견적서 작성</h2>
          <p className="adm-muted">
            위에서 서비스와 제품을 고르고 추가하면, 아래 견적 항목 표에 누적됩니다. 이미 추가한 항목은 서비스 변경으로 사라지지 않습니다.
          </p>
        </div>
        <span className="adm-badge adm-badge-blue">
          {orderId
            ? (currentQuoteVersion ? `${currentQuoteVersion}차 저장됨` : "첫 견적")
            : manualQuoteId
              ? "수동 견적 수정"
              : "주문 없이 작성 가능"}
        </span>
      </div>

      <div className="adm-quote-order-meta">
        <span>
          <b>주문번호</b>
          <strong>{orderNumber || "주문을 선택하세요"}</strong>
        </span>
        <span>
          <b>고객명</b>
          {editableCustomerFields ? (
            <input className="adm-input" value={draftCustomerName} onChange={(event) => setDraftCustomerName(event.target.value)} disabled={Boolean(saving)} placeholder="고객명 입력" />
          ) : (
            <strong>{draftCustomerName || "-"}</strong>
          )}
        </span>
        <span>
          <b>연락처</b>
          {editableCustomerFields ? (
            <input className="adm-input" value={draftCustomerPhone} onChange={(event) => setDraftCustomerPhone(event.target.value)} disabled={Boolean(saving)} placeholder="연락처 입력" />
          ) : (
            <strong>{draftCustomerPhone || "-"}</strong>
          )}
        </span>
        <span>
          <b>주소</b>
          {editableCustomerFields ? (
            <input className="adm-input" value={draftAddressText} onChange={(event) => setDraftAddressText(event.target.value)} disabled={Boolean(saving)} placeholder="주소 입력" />
          ) : (
            <strong>{draftAddressText || "-"}</strong>
          )}
        </span>
      </div>

      <div className="adm-quote-summary-strip">
        <span><b>주문 기준</b><strong>{orderId ? "선택됨" : "미선택"}</strong></span>
        <span><b>제품값</b><strong>{formatKRW(totals.productTotal)}</strong></span>
        <span><b>시공비</b><strong>{formatKRW(totals.laborTotal)}</strong></span>
        <span><b>폐기물 처리비</b><strong>{formatKRW(visitFee)}</strong><small>{selfDisposal ? "직접 처리" : `제품 ${totalUnits}개 × 10,000원`}</small></span>
        <span><b>소계</b><strong>{formatKRW(totals.subtotalTotal)}</strong></span>
        <span><b>최종 합계</b><strong>{formatKRW(totals.finalTotal)}</strong><small>부가세 10% 포함</small></span>
        <span><b>예약 일정</b><strong>{formatScheduleVisitText(scheduleDate, scheduleTime)}</strong><small>일정관리 슬롯 기준</small></span>
      </div>

      <section className="adm-quote-builder-card">
        <div className="adm-section-head">
          <div>
            <h3 className="adm-card-title">견적 입력</h3>
            <p className="adm-muted">서비스와 제품을 선택한 뒤 `추가`를 눌러 아래 견적 항목에 쌓습니다.</p>
          </div>
        </div>
        <div className="adm-form-row adm-form-row-quote">
          <label>
            <span className="adm-label">서비스</span>
            <select
              className="adm-input"
              value={builderServiceCode}
              onChange={(event) => {
                setBuilderServiceCode(event.target.value);
                setBuilderProductId("");
              }}
              disabled={Boolean(saving)}
            >
              {serviceOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="adm-label">제품</span>
            <select
              className="adm-input"
              value={builderProductId}
              onChange={(event) => setBuilderProductId(event.target.value)}
              disabled={Boolean(saving)}
            >
              <option value="">제품 선택</option>
              {activeCatalog?.groups.map((group) => (
                <optgroup key={group.id} label={group.name}>
                  {group.products.map((catalogProduct) => (
                    <option key={catalogProduct.id} value={catalogProduct.id}>
                      {catalogProduct.label} · {formatKRW(catalogProduct.price)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            <span className="adm-label">수량</span>
            <div className="adm-quote-qty-action">
              <input
                className="adm-input"
                type="number"
                min={1}
                step={1}
                value={builderQty}
                onChange={(event) => setBuilderQty(normalizeQty(Number(event.target.value || 1)))}
                disabled={Boolean(saving)}
              />
              <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={addCommittedItem} disabled={Boolean(saving)}>
                추가
              </button>
            </div>
          </label>
        </div>
        <div className="adm-quote-item-meta">
          <span><b>선택 정보</b><strong>{activeProduct ? activeProduct.label : "제품을 선택해 주세요."}</strong></span>
          <span><b>품번</b><strong>{activeProduct?.sku ?? "-"}</strong></span>
          <span><b>제품값</b><strong>{activeProduct ? formatKRW(activeProduct.price * builderQty) : "-"}</strong></span>
          <span><b>시공비</b><strong>{activeProduct ? formatKRW(activeProduct.laborPrice * builderQty) : "-"}</strong></span>
        </div>
      </section>

      <section className="adm-quote-lines-preview">
        <div className="adm-section-head">
          <div>
            <h3 className="adm-card-title">견적 항목</h3>
            <p className="adm-muted">견적서에는 사진, 품번, 제품명, 수량, 금액 순으로 들어갑니다.</p>
          </div>
        </div>
        <div className="adm-quote-lines-table">
          <div className="adm-quote-lines-head">
            <span>사진</span>
            <span>품번</span>
            <span>제품명</span>
            <span>수량</span>
            <span>금액(원)</span>
          </div>
          {totals.resolvedItems.length > 0 ? (
            totals.resolvedItems.map(({ item, product }, index) => (
              <div className="adm-quote-lines-row" key={`preview-${item.serviceTypeCode}-${item.productId}-${index}`}>
                <span className="adm-quote-line-photo">
                  {product?.image ? <img src={product.image} alt={product.label} /> : <span className="adm-quote-line-photo-empty">-</span>}
                </span>
                <span className="adm-quote-line-sku">{product?.sku ?? "-"}</span>
                <span className="adm-quote-line-name">
                  <strong>{product?.label ?? "-"}</strong>
                  <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={() => removeCommittedItem(index)} disabled={Boolean(saving)}>
                    제거
                  </button>
                </span>
                <span className="adm-quote-line-qty">
                  <input
                    className="adm-input adm-quote-line-qty-input"
                    type="number"
                    min={1}
                    step={1}
                    value={item.qty}
                    onChange={(event) => updateCommittedQty(index, Number(event.target.value || 1))}
                    disabled={Boolean(saving)}
                  />
                </span>
                <span className="adm-quote-line-amount">{formatKRW(Number(product?.price ?? 0) * item.qty)}</span>
              </div>
            ))
          ) : (
            <div className="adm-empty adm-empty-line">
              <div className="adm-empty-title">견적 항목이 아직 없습니다.</div>
              <p className="adm-muted">위에서 제품을 고르고 `추가`를 누르면 여기에 누적됩니다.</p>
            </div>
          )}
        </div>
      </section>

      <section className="adm-quote-option-card">
        <div className="adm-section-head">
          <div>
            <h3 className="adm-card-title">폐기물 처리</h3>
            <p className="adm-muted">실제 제품 주문과 동일하게 제품 1개당 10,000원을 자동 반영합니다.</p>
          </div>
          <strong>{formatKRW(visitFee)}</strong>
        </div>
        <label className="adm-inline-check">
          <input
            type="checkbox"
            checked={selfDisposal}
            onChange={(event) => setSelfDisposal(event.target.checked)}
            disabled={Boolean(saving)}
          />
          <span>폐기물은 고객이 직접 처리합니다</span>
        </label>
        <small className="adm-field-help">
          체크하지 않으면 폐기물 처리비가 제품 수량 {totalUnits}개 기준으로 {formatKRW(PRODUCT_DISPOSAL_FEE * totalUnits)} 반영됩니다.
        </small>
      </section>

      <section className="adm-quote-schedule-card">
        <div className="adm-section-head">
          <div>
            <h3 className="adm-card-title">예약 일정 선택</h3>
            <p className="adm-muted">고객 주문 예약과 같은 슬롯 기준으로 날짜와 오전/오후를 선택합니다. 저장하면 주문 일정에 바로 반영됩니다.</p>
          </div>
          <div className="adm-inline-actions">
            {slotLoading ? <span className="adm-badge adm-badge-gray">슬롯 확인 중</span> : null}
            <a className="adm-btn adm-btn-secondary adm-btn-sm" href="/admin/slots" target="_blank" rel="noreferrer">
              일정관리 열기
            </a>
          </div>
        </div>
        <div className="adm-quote-calendar-head">
          <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={previousMonth} disabled={Boolean(saving)}>
            이전
          </button>
          <strong>{calendarMonth.year}년 {calendarMonth.month}월</strong>
          <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={nextMonth} disabled={Boolean(saving)}>
            다음
          </button>
        </div>
        <div className={`adm-quote-calendar ${slotLoading ? "loading" : ""}`}>
          {DATE_WEEKDAYS.map((weekday, index) => (
            <span key={weekday} className={`adm-quote-calendar-weekday${index === 0 ? " sun" : index === 6 ? " sat" : ""}`}>
              {weekday}
            </span>
          ))}
          {renderScheduleCalendar()}
        </div>
        <div>
          <span className="adm-label">시간대</span>
          <div className="adm-quote-slot-actions">
            {(["morning", "afternoon"] as const).map((period) => {
              const dayInfo = scheduleDate ? slotDays[scheduleDate] : null;
              const available = Boolean(scheduleDate && (!dayInfo || dayInfo.slots[period]?.available));
              return (
                <button
                  key={period}
                  type="button"
                  className={`adm-btn ${scheduleTime === period ? "adm-btn-primary" : "adm-btn-secondary"}`}
                  onClick={() => setScheduleTime(period)}
                  disabled={Boolean(saving) || !scheduleDate || !available}
                >
                  {slotLabel(period)}{scheduleDate && !available ? " · 마감" : ""}
                </button>
              );
            })}
          </div>
          <small className="adm-field-help">
            선택한 일정은 저장된 주문의 방문 슬롯으로 계산됩니다. 수동 견적은 제품 주문 전환 시 일정관리와 고객 예약 슬롯에 반영됩니다.
          </small>
        </div>
        {slotMessage ? <p className="adm-form-message adm-form-message-error">{slotMessage}</p> : null}
      </section>

      <div className="adm-inline-actions">
        <button className="adm-btn adm-btn-secondary" type="button" onClick={previewQuoteDocument} disabled={Boolean(saving) || totals.resolvedItems.length === 0}>
          견적서 미리보기
        </button>
        <button className="adm-btn adm-btn-primary" type="button" onClick={() => submit(false)} disabled={Boolean(saving)}>
          {saving === "save" ? "저장 중..." : "견적 저장"}
        </button>
        <button className="adm-btn adm-btn-secondary" type="button" onClick={() => submit(true)} disabled={Boolean(saving)}>
          {saving === "download" ? "저장/견적서 준비 중..." : "저장 후 견적서 보기"}
        </button>
      </div>
      <p className="adm-help">
        주문에서 들어온 견적은 상세에서 계속 수정할 수 있고, 여기서는 수동 견적 작성도 가능합니다. 제품 금액은 견적 표 기준, 시공비와 폐기물 처리비는 합계에 반영됩니다.
        {localMode ? " 로컬 확인 모드에서는 브라우저 세션 기준으로 임시 저장됩니다." : ""}
      </p>
      {message ? <p className="adm-form-message">{message}</p> : null}
    </section>
  );
}
