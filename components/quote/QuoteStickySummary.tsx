"use client";

import { useRef, useState, type ReactNode, type TouchEvent } from "react";
import { SERVICE_AREA_LABEL } from "@/lib/public-services";

type QuoteStickySummaryProps = {
  total: string;
  serviceName: string;
  date?: string;
  slot?: string;
  photoCount: number;
  message?: string;
  paymentAvailable: boolean;
  mockPaymentMode: boolean;
  loading: boolean;
  onPayment: () => void;
  onPaymentBlocked?: () => boolean | void;
  productSelection?: ReactNode;
  selectionReady?: boolean;
  selectionMessage?: string;
  mobileSummaryLabel?: string;
  summaryTitle?: string;
  paymentButtonLabel?: string;
  paymentReadyMessage?: string;
};

function slotLabel(slot?: string) {
  if (slot === "morning") return "오전";
  if (slot === "afternoon") return "오후";
  return "시간 선택 전";
}

export function QuoteStickySummary({
  total,
  serviceName,
  date,
  slot,
  photoCount,
  message,
  paymentAvailable,
  mockPaymentMode,
  loading,
  onPayment,
  onPaymentBlocked,
  productSelection,
  selectionReady = true,
  selectionMessage = "필수 선택을 완료해주세요.",
  mobileSummaryLabel,
  summaryTitle = "결제 요약",
  paymentButtonLabel = "결제 진행하기",
  paymentReadyMessage = "결제 후 방문 일정이 확정됩니다."
}: QuoteStickySummaryProps) {
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [areaAccepted, setAreaAccepted] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const consentInputRef = useRef<HTMLInputElement | null>(null);
  const areaInputRef = useRef<HTMLInputElement | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragCurrentYRef = useRef<number | null>(null);
  const visitText = date ? `${date} ${slotLabel(slot)}` : "방문일 선택 전";
  const paymentBlocked = !selectionReady || !policyAccepted || !areaAccepted;
  const paymentDisabled = loading || !paymentAvailable;
  const paymentTitle = !selectionReady
    ? selectionMessage
    : !paymentAvailable
    ? "결제 모듈 준비 중입니다"
    : !policyAccepted
      ? "필수 안내를 확인하면 결제를 진행할 수 있어요"
      : !areaAccepted
        ? "작업 가능 지역을 확인하면 결제를 진행할 수 있어요"
      : mockPaymentMode
        ? "테스트 결제 모드입니다"
        : undefined;
  const hasProductSelection = Boolean(productSelection);
  const stickyClassName = [
    "sticky-cta",
    summaryOpen ? "expanded" : "",
    hasProductSelection ? "has-product-selection" : "",
    selectionReady ? "selection-ready" : ""
  ]
    .filter(Boolean)
    .join(" ");

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (!summaryOpen) return;
    if (event.currentTarget.scrollTop > 4) {
      dragStartYRef.current = null;
      dragCurrentYRef.current = null;
      return;
    }
    const touch = event.touches[0];
    dragStartYRef.current = touch?.clientY ?? null;
    dragCurrentYRef.current = touch?.clientY ?? null;
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (!summaryOpen || dragStartYRef.current === null) return;
    const touch = event.touches[0];
    dragCurrentYRef.current = touch?.clientY ?? null;
  }

  function handleTouchEnd() {
    if (!summaryOpen || dragStartYRef.current === null || dragCurrentYRef.current === null) {
      dragStartYRef.current = null;
      dragCurrentYRef.current = null;
      return;
    }

    const movedDown = dragCurrentYRef.current - dragStartYRef.current;
    if (movedDown > 48) {
      setSummaryOpen(false);
    }
    dragStartYRef.current = null;
    dragCurrentYRef.current = null;
  }

  function handlePaymentButtonClick() {
    if (loading || !paymentAvailable) return;
    if (!selectionReady) {
      onPaymentBlocked?.();
      return;
    }
    if (onPaymentBlocked?.()) {
      return;
    }
    if (!policyAccepted) {
      consentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => consentInputRef.current?.focus({ preventScroll: true }), 220);
      return;
    }
    if (!areaAccepted) {
      areaInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => areaInputRef.current?.focus({ preventScroll: true }), 220);
      return;
    }
    onPayment();
  }

  return (
    <div
      className={stickyClassName}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <button
        type="button"
        className="mobile-summary-toggle"
        aria-expanded={summaryOpen}
        onClick={() => setSummaryOpen((current) => !current)}
      >
        <span>{mobileSummaryLabel ?? serviceName}</span>
        <strong>{total}</strong>
      </button>
      <div className="sticky-sheet-content">
        {productSelection}
        <div className="sticky-cta-head">
          <span>{summaryTitle}</span>
          <strong>{total}</strong>
        </div>
        <div className="sticky-summary" aria-label="결제 요약">
          <div>
            <span>서비스</span>
            <small>{serviceName}</small>
          </div>
          <div>
            <span>일정</span>
            <small>{visitText}</small>
          </div>
          <div>
            <span>사진</span>
            <small>{photoCount}장</small>
          </div>
        </div>
        {message && <p className="sticky-message">{message}</p>}
        {!selectionReady && <p className="sticky-message">{selectionMessage}</p>}
        {selectionReady && !paymentAvailable && <p className="sticky-message">결제 기능은 곧 연결됩니다. 지금은 카톡 상담으로 예약 가능합니다.</p>}
        {selectionReady && paymentAvailable && <p className="sticky-message">{mockPaymentMode ? "테스트 결제 모드입니다." : paymentReadyMessage}</p>}
        {selectionReady && paymentAvailable && (
          <div className="payment-method-notice" aria-label="결제수단">
            <span className="payment-method-check" aria-hidden="true">✓</span>
            <span>
              <strong>계좌이체</strong>
              <small>주문 확인 후 입금 안내를 확인합니다.</small>
            </span>
          </div>
        )}
        <div className="payment-consent-group">
          <label className="payment-consent">
            <input ref={consentInputRef} type="checkbox" checked={policyAccepted} onChange={(event) => setPolicyAccepted(event.target.checked)} />
            <span className="payment-consent-text">
              주문 내용과 방문 일정,{" "}
              <span className="payment-consent-nowrap"><a href="/privacy" target="_blank" rel="noreferrer">개인정보 처리방침</a></span>,{" "}
              <span className="payment-consent-nowrap"><a href="/refund-policy" target="_blank" rel="noreferrer">취소·환불 안내</a>를</span>{" "}
              확인했습니다.
            </span>
          </label>
          <label className="payment-consent payment-consent-area">
            <input ref={areaInputRef} type="checkbox" checked={areaAccepted} onChange={(event) => setAreaAccepted(event.target.checked)} />
            <span className="payment-consent-text">
              작업 가능 지역은 <strong>{SERVICE_AREA_LABEL}</strong>입니다.
            </span>
          </label>
        </div>
        <button
          type="button"
          disabled={paymentDisabled}
          aria-disabled={paymentDisabled || paymentBlocked}
          title={paymentTitle}
          className="strong payment-button"
          onClick={handlePaymentButtonClick}
        >
          {loading
            ? "계좌이체 안내 준비 중..."
            : !paymentAvailable
              ? "결제 준비 중"
              : !selectionReady
                ? "제품 선택 후 결제"
                : policyAccepted && areaAccepted
                  ? paymentButtonLabel
                  : "안내 확인 후 결제"}
        </button>
      </div>
    </div>
  );
}
