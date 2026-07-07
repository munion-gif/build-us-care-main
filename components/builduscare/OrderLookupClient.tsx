"use client";

import Link from "next/link";
import { Calendar, Check, ChevronLeft, Headphones, Info, MessageCircle, Package, Truck, Wallet, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { MobileAppBar, MobileBottomNav } from "@/components/builduscare/MobileAppChrome";
import { BUILDUSCARE_CATEGORIES } from "@/lib/builduscare-public-routes";
import { getBuilduscarePublicCatalog } from "@/lib/builduscare-public-products";
import { isSiliconeLaborService } from "@/lib/builduscare-labor";

type LookupOrder = {
  orderNumber: string;
  status: string;
  statusUrl?: string;
  transferUrl?: string | null;
  serviceName: string;
  customerName: string;
  phone: string;
  roadAddress: string;
  detailAddress: string;
  selected: Array<{
    id: string;
    brand?: string;
    name: string;
    image: string;
    qty: number;
    price: number;
    selectedColor?: string;
    categoryName?: string;
    serviceCode?: string;
  }>;
  cashReceipt?: { text?: string } | null;
  photoCount: number;
  reservation: { date: string; time: string; status: string } | null;
  totals: {
    productAmount: number;
    laborAmount: number;
    shippingAmount?: number;
    disposalAmount?: number;
    totalAmount: number;
    onsitePaymentAmount?: number;
    onlinePaymentAmount?: number;
  };
  payment?: { status?: string; provider?: string; amount?: number } | null;
};

const ORDER_RESULT_STORAGE_KEY = "builduscare:lastOrderResult";
const PRODUCT_IMAGE_BY_ID = new Map(
  BUILDUSCARE_CATEGORIES.flatMap((category) => getBuilduscarePublicCatalog(category.serviceCode)?.products ?? [])
    .map((product) => [product.id, product.image] as const)
);

function formatKRW(value?: number | null) {
  return `${Number(value ?? 0).toLocaleString("ko-KR")}원`;
}

function publicImageSrc(src?: string | null) {
  const value = String(src ?? "").trim();
  if (!value) return "/assets/bc-logo.png";
  if (/^(?:https?:)?\/\//i.test(value) || value.startsWith("/") || value.startsWith("data:") || value.startsWith("blob:")) return value;
  return `/${value}`;
}

function lookupItemImage(item: LookupOrder["selected"][number]) {
  return publicImageSrc(PRODUCT_IMAGE_BY_ID.get(item.id) || item.image);
}

function paymentStatusLabel(order: LookupOrder) {
  const normalized = normalizeOrderStatus(order.status);
  if (order.payment?.status === "pending") return "입금 대기";
  if (normalized === "pending_product_payment" || normalized === "payment_pending") return "입금 대기";
  if (normalized === "product_paid" || normalized === "paid") return "결제 완료";
  if (normalized === "scheduled") return "방문 확정";
  if (normalized === "in_progress") return "시공 중";
  if (normalized === "completed") return "최종 확인 중";
  if (normalized === "done") return "완료";
  if (normalized === "issue") return "문제 확인 중";
  if (normalized === "warranty") return "A/S 접수";
  if (normalized === "cancel_requested") return "취소 요청";
  if (normalized === "canceled" || normalized === "refunded") return "취소됨";
  if (normalized === "quoted") return "견적 안내";
  return "확인 중";
}

function slotText(slot?: string | null) {
  if (slot === "morning") return "오전";
  if (slot === "afternoon") return "오후";
  return slot || "미정";
}

function addressText(order: LookupOrder) {
  return [order.roadAddress, order.detailAddress].filter(Boolean).join(" ") || "주소 확인 중";
}

function reservationText(order: LookupOrder) {
  return order.reservation ? `${order.reservation.date} ${slotText(order.reservation.time)}` : "사진 확인 후 협의";
}

function paymentAmount(order: LookupOrder) {
  return Number(order.payment?.amount ?? order.totals?.onlinePaymentAmount ?? order.totals?.productAmount ?? 0);
}

function selectedSummary(order: LookupOrder) {
  const count = order.selected?.length ?? 0;
  const units = order.selected?.reduce((sum, item) => sum + Number(item.qty || 1), 0) ?? 0;
  const onlySilicone = count > 0 && order.selected.every((item) => isSiliconeLaborService(item.serviceCode));
  return `${count}종 · 총 ${onlySilicone ? `${units}m` : `${units}개`}`;
}

function itemQtyText(item: LookupOrder["selected"][number]) {
  const qty = Number(item.qty || 1);
  return isSiliconeLaborService(item.serviceCode) ? `${qty}m` : `${qty}개`;
}

function hasSiliconeItems(order: LookupOrder) {
  return order.selected?.some((item) => isSiliconeLaborService(item.serviceCode)) ?? false;
}

function normalizeOrderNumber(value?: string | null) {
  return String(value ?? "").trim().toUpperCase();
}

function readStoredLookupOrder(orderNumber: string, name: string): LookupOrder | null {
  try {
    const raw = window.localStorage.getItem(ORDER_RESULT_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<LookupOrder> & Record<string, any>;
    const storedOrderNumber = normalizeOrderNumber(stored.orderNumber);
    const wantedOrderNumber = normalizeOrderNumber(orderNumber);
    if (!storedOrderNumber || storedOrderNumber !== wantedOrderNumber) return null;

    const storedName = String(stored.customerName ?? window.localStorage.getItem("builduscare:lastCustomerName") ?? "").trim();
    const wantedName = String(name ?? "").trim();
    if (storedName && wantedName && storedName !== wantedName) return null;

    const storedSelected = Array.isArray(stored.selected)
      ? stored.selected
      : Array.isArray(stored.selectedProducts)
        ? stored.selectedProducts
        : Array.isArray(stored.selected_products)
          ? stored.selected_products
          : Array.isArray(stored.products)
            ? stored.products
            : Array.isArray(stored.items)
              ? stored.items
              : [];
    const selectedRows = storedSelected.map((item: any) => ({
      id: String(item.id ?? item.productId ?? item.product_id ?? item.sku ?? item.name ?? ""),
      brand: item.brand ? String(item.brand) : undefined,
      name: String(item.name ?? item.displayName ?? item.productName ?? item.model ?? item.id ?? item.productId ?? "선택 제품"),
      image: String(item.image ?? ""),
      qty: Math.max(1, Number(item.qty || 1)),
      price: Number(item.price ?? item.roundedPrice ?? item.unitPrice ?? item.amount ?? 0),
      selectedColor: item.selectedColor || item.color ? String(item.selectedColor ?? item.color) : undefined,
      categoryName: item.categoryName ? String(item.categoryName) : undefined,
      serviceCode: item.serviceCode ? String(item.serviceCode) : undefined
    }));
    const fallbackStatus = selectedRows.length > 0 ? "pending_product_payment" : "inquiry";
    const storedCashReceipt = stored.cashReceipt as Record<string, any> | null | undefined;
    const storedTotals = (stored.totals ?? {}) as Record<string, any>;
    const cashReceiptType = String(storedCashReceipt?.type ?? "");
    const cashReceiptIdentity = String(storedCashReceipt?.identity ?? storedCashReceipt?.number ?? "").trim();
    const storedReservation = stored.reservation as Record<string, any> | null | undefined;
    const cashReceiptText =
      storedCashReceipt?.text ??
      (storedCashReceipt?.requested
        ? `${storedCashReceipt.type === "business" ? "사업자" : "개인"} · ${storedCashReceipt.identity ?? storedCashReceipt.number ?? ""}`.trim()
        : cashReceiptType && cashReceiptType !== "none"
          ? `${cashReceiptType === "business" ? "사업자 지출증빙" : "개인 소득공제"}${cashReceiptIdentity ? ` / ${cashReceiptIdentity}` : ""}`
          : undefined);
    const laborAmount = Number(storedTotals.laborAmount ?? stored.totalLabor ?? 0);
    const shippingAmount = Number(storedTotals.shippingAmount ?? stored.shippingAmount ?? 0);
    const disposalAmount = Number(storedTotals.disposalAmount ?? storedTotals.wasteAmount ?? stored.disposalAmount ?? 0);
    const onsitePaymentAmount = Number(
      storedTotals.onsitePaymentAmount ??
      storedTotals.onsiteAmount ??
      stored.onsitePaymentAmount ??
      stored.onsiteAmount ??
      (laborAmount + disposalAmount)
    );
    const reservationDate = storedReservation?.date ?? stored.reservationDate ?? stored.date ?? "";
    const reservationTime = storedReservation?.time ?? storedReservation?.timeSlot ?? storedReservation?.timeLabel ?? stored.reservationTime ?? stored.time ?? "";

    return {
      orderNumber: storedOrderNumber,
      status: String(stored.status ?? fallbackStatus),
      statusUrl: stored.statusUrl,
      transferUrl: stored.transferUrl ?? null,
      serviceName: String(stored.serviceName ?? stored.itemLabel ?? stored.item ?? "Build us Care 접수"),
      customerName: storedName || wantedName,
      phone: String(stored.phone ?? stored.customerPhone ?? ""),
      roadAddress: String(stored.roadAddress ?? stored.address ?? ""),
      detailAddress: String(stored.detailAddress ?? ""),
      selected: selectedRows,
      cashReceipt: cashReceiptText ? { text: cashReceiptText } : stored.cashReceipt ?? null,
      photoCount: Number(stored.photoCount ?? 0),
      reservation: reservationDate ? {
        date: String(reservationDate),
        time: String(reservationTime),
        status: String(storedReservation?.status ?? "scheduled")
      } : null,
      totals: {
        productAmount: Number(storedTotals.productAmount ?? stored.totalMaterial ?? 0),
        laborAmount,
        shippingAmount,
        disposalAmount,
        totalAmount: Number(storedTotals.totalAmount ?? stored.totalFinal ?? 0),
        onsitePaymentAmount,
        onlinePaymentAmount: Number(storedTotals.onlinePaymentAmount ?? storedTotals.productAmount ?? stored.totalMaterial ?? 0)
      },
      payment: stored.payment ?? null
    };
  } catch {
    return null;
  }
}

function normalizeOrderStatus(status?: string | null) {
  const raw = String(status || "").trim();
  if (raw === "cancelled") return "canceled";
  if (raw === "submitted" || raw === "draft") return "inquiry";
  if (raw === "reservation_pending") return "payment_pending";
  if (raw === "reservation_confirmed" || raw === "preparing") return "scheduled";
  if (raw === "installation_completed") return "completed";
  if (raw === "in_service") return "in_progress";
  return raw;
}

function productOrderStage(order: LookupOrder) {
  const normalized = normalizeOrderStatus(order.status);
  if (normalized === "product_paid" || normalized === "paid") return "assign";
  if (normalized === "scheduled") return "scheduled";
  if (normalized === "in_progress") return "visit";
  if (["completed", "done", "issue", "warranty"].includes(normalized)) return "finish";
  if (normalized === "pending_product_payment" || normalized === "payment_pending" || order.payment?.status === "pending" || order.transferUrl) return "payment";
  return "payment";
}

function canWarranty(order: LookupOrder) {
  return ["done", "warranty", "issue"].includes(normalizeOrderStatus(order.status));
}

function supportActionText(order: LookupOrder) {
  return canWarranty(order) ? "A/S 접수" : "카카오톡 상담";
}

type TimelineRow = {
  state: "done" | "now" | "todo";
  title: string;
  desc: string;
};

function productTimeline(order: LookupOrder): TimelineRow[] {
  const stage = productOrderStage(order);
  const amountText = `${formatKRW(paymentAmount(order))} · 계좌이체 안내 확인`;
  if (stage === "payment") {
    return [
      { state: "done", title: "제품 주문 접수", desc: "접수 완료" },
      { state: "now", title: "제품 금액 입금 대기", desc: amountText },
      { state: "todo", title: "기사 배정 · 방문 일정 조율", desc: "입금 확인 후 순차 안내" },
      { state: "todo", title: "방문 교체", desc: "현장 시공 진행" },
      { state: "todo", title: "완료 · 보증 시작", desc: "완료 리포트 · A/S" }
    ];
  }
  if (stage === "assign") {
    return [
      { state: "done", title: "제품 주문 접수", desc: "접수 완료" },
      { state: "done", title: "제품 금액 입금 확인", desc: "입금 확인 완료" },
      { state: "now", title: "기사 배정 · 방문 일정 조율", desc: "방문 날짜와 시간 안내 예정" },
      { state: "todo", title: "방문 교체", desc: "현장 시공 진행" },
      { state: "todo", title: "완료 · 보증 시작", desc: "완료 리포트 · A/S" }
    ];
  }
  if (stage === "scheduled") {
    return [
      { state: "done", title: "제품 주문 접수", desc: "접수 완료" },
      { state: "done", title: "제품 금액 입금 확인", desc: "입금 확인 완료" },
      { state: "now", title: "방문 일정 확정", desc: order.reservation?.date ? reservationText(order) : "예약 일정 확정" },
      { state: "todo", title: "방문 교체", desc: "예약한 일정에 맞춰 방문" },
      { state: "todo", title: "완료 · 보증 시작", desc: "완료 리포트 · A/S" }
    ];
  }
  if (stage === "visit") {
    return [
      { state: "done", title: "제품 주문 접수", desc: "접수 완료" },
      { state: "done", title: "제품 금액 입금 확인", desc: "입금 확인 완료" },
      { state: "done", title: "방문 일정 확정", desc: "기사 배정 완료" },
      { state: "now", title: "방문 교체", desc: "현장 시공 진행 중" },
      { state: "todo", title: "완료 · 보증 시작", desc: "완료 리포트 · A/S" }
    ];
  }

  const normalized = normalizeOrderStatus(order.status);
  const finishLabel = normalized === "warranty" ? "A/S 접수 진행" : normalized === "issue" ? "시공 후 확인 필요" : normalized === "completed" ? "최종 확인 중" : "완료 · 보증 시작";
  const finishDesc = normalized === "warranty" ? "담당자가 접수 내용을 확인 중" : normalized === "issue" ? "담당자가 확인 후 안내 예정" : normalized === "completed" ? "최종 확인 및 정산 진행" : "완료 리포트 · A/S";
  return [
    { state: "done", title: "제품 주문 접수", desc: "접수 완료" },
    { state: "done", title: "제품 금액 입금 확인", desc: "입금 확인 완료" },
    { state: "done", title: "방문 일정 확정", desc: "기사 배정 완료" },
    { state: "done", title: "방문 교체", desc: "현장 시공 완료" },
    { state: "now", title: finishLabel, desc: finishDesc }
  ];
}

function photoTimeline(): TimelineRow[] {
  return [
    { state: "done", title: "사진 확인 접수", desc: "접수 완료" },
    { state: "now", title: "매니저 확인 중", desc: "가능 여부·정찰가 확인" },
    { state: "todo", title: "견적·예약 확정", desc: "동의 후 진행" },
    { state: "todo", title: "방문 교체", desc: "희망 일정 기준" },
    { state: "todo", title: "완료 · 보증 시작", desc: "완료 리포트 · A/S" }
  ];
}

function orderStatusSummary(order: LookupOrder, hasProducts: boolean) {
  if (!hasProducts) {
    return {
      title: "매니저가 사진을 확인 중이에요",
      desc: "영업시간 기준 2시간 내 견적을 카카오톡으로 안내해 드릴게요."
    };
  }
  const stage = productOrderStage(order);
  if (stage === "payment") {
    return {
      title: "제품 금액 입금 대기",
      desc: `${formatKRW(paymentAmount(order))} 입금 확인 후 기사 배정과 방문 일정 안내가 진행돼요.`
    };
  }
  if (stage === "assign") {
    return {
      title: "기사 배정과 방문 일정 조율 중",
      desc: "입금 확인이 완료됐고, 담당 기사와 방문 시간대를 순차적으로 안내해 드릴게요."
    };
  }
  if (stage === "scheduled") {
    return {
      title: "방문 일정이 확정됐어요",
      desc: order.reservation?.date ? `${reservationText(order)} 방문 예정이에요.` : "확정된 일정에 맞춰 방문 준비 중이에요."
    };
  }
  if (stage === "visit") {
    return {
      title: "현장 시공이 진행 중이에요",
      desc: "시공 완료 후 완료 상태와 A/S 안내를 확인할 수 있어요."
    };
  }
  const normalized = normalizeOrderStatus(order.status);
  if (normalized === "issue") return { title: "시공 후 확인이 필요해요", desc: "담당자가 문제 내용을 확인하고 안내해 드릴게요." };
  if (normalized === "warranty") return { title: "A/S 접수가 진행 중이에요", desc: "접수 내용을 확인한 뒤 카카오톡으로 안내해 드릴게요." };
  if (normalized === "completed") return { title: "최종 확인 중이에요", desc: "완료 처리와 정산 확인을 진행 중이에요." };
  return { title: "시공이 완료됐어요", desc: "완료 리포트와 A/S 가능 상태를 확인할 수 있어요." };
}

export function OrderLookupClient() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [order, setOrder] = useState<LookupOrder | null>(null);
  const [initialQueryReady, setInitialQueryReady] = useState(false);
  const [shouldAutoLookup, setShouldAutoLookup] = useState(false);
  const hasProducts = Boolean(order?.selected?.length);
  const statusSummary = order ? orderStatusSummary(order, hasProducts) : null;
  const timelineRows = order ? (hasProducts ? productTimeline(order) : photoTimeline()) : [];
  const showTransferGuide = Boolean(order && hasProducts && productOrderStage(order) === "payment" && order.transferUrl);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("orderNumber") ?? params.get("orderNo") ?? params.get("order") ?? params.get("receipt") ?? params.get("orderId") ?? "";
    const fromPhone = params.get("phone") ?? params.get("tel") ?? "";
    const storedOrderNumber = window.localStorage.getItem("builduscare:lastOrderNumber") ?? "";
    const storedPhone = window.localStorage.getItem("builduscare:lastPhone") ?? "";
    setOrderNumber((fromQuery || storedOrderNumber).toUpperCase());
    setPhone(fromPhone || storedPhone);
    setShouldAutoLookup(Boolean(fromQuery && fromPhone));
    setInitialQueryReady(true);
  }, []);

  useEffect(() => {
    if (!initialQueryReady || !shouldAutoLookup) return;
    if (!orderNumber.trim() || !phone.trim()) return;
    setShouldAutoLookup(false);
    void lookup();
  }, [initialQueryReady, phone, orderNumber, shouldAutoLookup]);

  async function lookup() {
    setMessage("");
    setOrder(null);
    if (!orderNumber.trim() || !phone.trim()) {
      setMessage("주문번호와 전화번호를 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const normalizedOrderNumber = orderNumber.trim().toUpperCase();
      const customerPhone = phone.trim();
      const response = await fetch("/api/builduscare/orders/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderNumber: normalizedOrderNumber, phone: customerPhone })
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? json?.message ?? "주문 조회에 실패했어요.");
      }
      if (!json.data?.order) {
        const storedOrder = readStoredLookupOrder(normalizedOrderNumber, "");
        if (storedOrder) {
          setOrder(storedOrder);
          return;
        }
        setMessage(json.data?.message ?? "입력하신 정보와 일치하는 주문을 찾지 못했어요.");
        return;
      }
      const storedOrder = readStoredLookupOrder(normalizedOrderNumber, "");
      if (json.data?.localMode && storedOrder) {
        setOrder({
          ...json.data.order,
          ...storedOrder,
          selected: storedOrder.selected?.length ? storedOrder.selected : json.data.order.selected,
          totals: storedOrder.totals ?? json.data.order.totals,
          payment: storedOrder.payment ?? json.data.order.payment,
          reservation: storedOrder.reservation ?? json.data.order.reservation,
          transferUrl: storedOrder.transferUrl ?? json.data.order.transferUrl,
          statusUrl: storedOrder.statusUrl ?? json.data.order.statusUrl
        });
        return;
      }
      setOrder(json.data.order);
    } catch (error) {
      const storedOrder = readStoredLookupOrder(orderNumber, "");
      if (storedOrder) {
        setOrder(storedOrder);
        return;
      }
      setMessage(error instanceof Error ? error.message : "주문 조회에 실패했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bc-page order-lookup-page">
      <MobileAppBar title="주문 조회" backHref="/" showBack={false} showChat />
      <div className="wrap narrow">
        <h1 className="web-h2">주문 조회</h1>
        <p className="web-lede" style={{ fontSize: 16, marginTop: 6 }}>주문번호와 전화번호를 입력하면 주문 내용을 확인할 수 있어요.</p>

        <section className="bcard pad order-lookup-card" style={{ padding: 24, marginTop: 22 }}>
          <div className="field">
            <label>주문번호</label>
            <input className="input" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value.toUpperCase())} placeholder="BC-000000-000" />
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>전화번호</label>
            <input className="input" type="tel" inputMode="numeric" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="010-1234-5678" />
          </div>
          {message && <div className="note" style={{ marginTop: 14, background: "#FDECEC", color: "#B42318", display: "flex", gap: 9, padding: "13px 15px", borderRadius: 14, fontSize: 13 }}><div>{message}</div></div>}
          <button className="web-btn pri lg block" style={{ marginTop: 18 }} type="button" aria-disabled={loading ? "true" : "false"} disabled={loading} onClick={lookup}>
            {loading ? "조회 중" : "주문 조회하기"}
          </button>
        </section>

        {order && statusSummary && (
          <section className="order-lookup-result" style={{ marginTop: 24 }}>
            <div className="between" style={{ alignItems: "center" }}>
              <h2 className="p-sm strong" style={{ margin: 0, color: "var(--gray-900)" }}>주문 확인</h2>
              <button className="web-btn sec" type="button" onClick={() => setOrder(null)}>
                <ChevronLeft aria-hidden="true" style={{ width: 16, height: 16 }} /> 조회
              </button>
            </div>

            <section className="bcard pad" style={{ padding: 24, marginTop: 18 }}>
              <div className="between">
                <span className="badge badge-warning dot">{paymentStatusLabel(order)}</span>
                <span className="p-sm strong" style={{ color: "var(--gray-600)" }}>{order.orderNumber}</span>
              </div>
              <div style={{ marginTop: 14, padding: "13px 14px", borderRadius: 16, background: "rgba(36,95,255,.07)", textAlign: "left" }}>
                <div className="p-sm strong" style={{ color: "var(--gray-900)" }}>{statusSummary.title}</div>
                <div className="p-sm" style={{ marginTop: 3, color: "var(--gray-600)", lineHeight: 1.45 }}>{statusSummary.desc}</div>
              </div>
              <div className="atl" style={{ marginTop: 18 }}>
                {timelineRows.map((row) => (
                  <div className={`atl-row ${row.state}`} key={`${row.title}-${row.state}`}>
                    <span className="atl-node">{row.state === "done" && <Check aria-hidden="true" />}</span>
                    <div><div className="tlt">{row.title}</div><div className="tld">{row.desc}</div></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bcard pad" style={{ padding: 24, marginTop: 14 }}>
              <div className="p-sm strong" style={{ color: "var(--gray-900)" }}>{hasProducts ? "예약 정보" : "접수 정보"}</div>
              <div className="col gap10" style={{ marginTop: 12 }}>
                <div className="between"><span className="p-sm" style={{ color: "var(--gray-600)" }}>예약자</span><span className="p-sm strong" style={{ color: "var(--gray-900)" }}>{order.customerName || "-"}</span></div>
                <div className="between"><span className="p-sm" style={{ color: "var(--gray-600)" }}>연락처</span><span className="p-sm strong" style={{ color: "var(--gray-900)" }}>{order.phone || "-"}</span></div>
                <div className="between" style={{ alignItems: "flex-start" }}><span className="p-sm" style={{ color: "var(--gray-600)" }}>시공 주소</span><span className="p-sm strong" style={{ color: "var(--gray-900)", textAlign: "right", maxWidth: "62%" }}>{addressText(order)}</span></div>
                {hasProducts ? (
                  <div className="between"><span className="p-sm" style={{ color: "var(--gray-600)" }}>예약 일시</span><span className="p-sm strong" style={{ color: "var(--gray-900)" }}>{reservationText(order)}</span></div>
                ) : (
                  <div className="between"><span className="p-sm" style={{ color: "var(--gray-600)" }}>안내 방식</span><span className="p-sm strong" style={{ color: "var(--gray-900)" }}>카카오톡 견적 안내</span></div>
                )}
                <div className="between"><span className="p-sm" style={{ color: "var(--gray-600)" }}>사진</span><span className="p-sm strong" style={{ color: "var(--gray-900)" }}>사진 {order.photoCount}장</span></div>
              </div>

              {order.selected?.length > 0 ? (
                <>
                  <div className="divline" style={{ margin: "16px 0" }} />
                  <div className="p-sm strong" style={{ color: "var(--gray-900)" }}>현금영수증 정보</div>
                  <div className="between" style={{ marginTop: 10 }}>
                    <span className="p-sm" style={{ color: "var(--gray-600)" }}>신청 상태</span>
                    <span className="p-sm strong" style={{ color: "var(--gray-900)", textAlign: "right", maxWidth: "62%" }}>{order.cashReceipt?.text ?? "신청 안 함"}</span>
                  </div>
                  <div className="divline" style={{ margin: "16px 0" }} />
                  <div className="p-sm strong" style={{ color: "var(--gray-900)" }}>선택 제품 <span className="p-sm" style={{ color: "var(--gray-400)", fontWeight: 500 }}>{selectedSummary(order)}</span></div>
                  <ul className="bc-estimate-list" style={{ marginTop: 14 }}>
                    {order.selected.map((item) => (
                      <li key={`${item.id}-${item.selectedColor ?? ""}`} className="bc-estimate-item">
                        <img
                          src={lookupItemImage(item)}
                          alt=""
                          onError={(event) => {
                            event.currentTarget.src = "/assets/bc-logo.png";
                          }}
                        />
                        <div>
                          <b>{item.name || item.id}</b>
                          <small>{[item.categoryName ?? item.serviceCode, item.selectedColor, itemQtyText(item)].filter(Boolean).join(" · ")}</small>
                        </div>
                        <strong>{formatKRW(item.price * (item.qty || 1))}</strong>
                      </li>
                    ))}
                  </ul>
                  <div className="divline" style={{ margin: "16px 0" }} />
                  <div className="bc-total">
                    <div className="bc-total-row"><span><Package aria-hidden="true" style={{ width: 15, height: 15, verticalAlign: -2 }} /> 제품비</span><strong>{formatKRW(order.totals?.productAmount)}</strong></div>
                    <div className="bc-total-row"><span><Wrench aria-hidden="true" style={{ width: 15, height: 15, verticalAlign: -2 }} /> 시공비</span><strong>{formatKRW(order.totals?.laborAmount)}</strong></div>
                    <div className="bc-total-row"><span><Truck aria-hidden="true" style={{ width: 15, height: 15, verticalAlign: -2 }} /> 배송비</span><strong>{formatKRW(order.totals?.shippingAmount)}</strong></div>
                    <div className="bc-total-row"><span><Package aria-hidden="true" style={{ width: 15, height: 15, verticalAlign: -2 }} /> 폐기물 처리비</span><strong>{formatKRW(order.totals?.disposalAmount)}</strong></div>
                    <div className="bc-total-row final">
                      <span>최종합계</span>
                      <strong>{formatKRW(order.totals?.totalAmount)}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="divline" style={{ margin: "16px 0" }} />
                  <div className="note info"><Info aria-hidden="true" /><div>사진확인 접수예요. 매니저가 사진을 확인한 뒤 영업시간 기준 2시간 내 견적을 카카오톡으로 안내해 드릴게요.</div></div>
                </>
              )}
            </section>

            <div className="row gap10" style={{ marginTop: 16, flexWrap: "wrap" }}>
              {showTransferGuide && order.transferUrl && <Link className="web-btn pri" href={order.transferUrl}><Wallet aria-hidden="true" /> 계좌이체 안내</Link>}
              {order.statusUrl && <Link className="web-btn sec" href={order.statusUrl}>상세 상태 보기</Link>}
              {hasProducts && <a className="web-btn sec" href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer"><Calendar aria-hidden="true" /> 예약 변경</a>}
              <a className="web-btn sec" href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer">
                {canWarranty(order) ? <Headphones aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
                {supportActionText(order)}
              </a>
            </div>
          </section>
        )}
      </div>
      <MobileBottomNav active="lookup" />
    </main>
  );
}
