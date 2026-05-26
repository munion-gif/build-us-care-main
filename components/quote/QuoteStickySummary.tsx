"use client";

import { useRef, useState, type ReactNode, type TouchEvent } from "react";

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
  productSelection?: ReactNode;
  selectionReady?: boolean;
  selectionMessage?: string;
  mobileSummaryLabel?: string;
  summaryTitle?: string;
  paymentButtonLabel?: string;
  paymentReadyMessage?: string;
  paymentMethod?: "CARD" | "TRANSFER";
  onPaymentMethodChange?: (method: "CARD" | "TRANSFER") => void;
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
  productSelection,
  selectionReady = true,
  selectionMessage = "필수 선택을 완료해주세요.",
  mobileSummaryLabel,
  summaryTitle = "결제 요약",
  paymentButtonLabel = "결제 진행하기",
  paymentReadyMessage = "결제 후 방문 일정이 확정됩니다.",
  paymentMethod = "CARD",
  onPaymentMethodChange
}: QuoteStickySummaryProps) {
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const dragStartYRef = useRef<number | null>(null);
  const dragCurrentYRef = useRef<number | null>(null);
  const visitText = date ? `${date} ${slotLabel(slot)}` : "방문일 선택 전";
  const paymentDisabled = loading || !selectionReady || !paymentAvailable || !policyAccepted;
  const paymentTitle = !selectionReady
    ? selectionMessage
    : !paymentAvailable
    ? "결제 모듈 준비 중입니다"
    : !policyAccepted
      ? "필수 안내를 확인하면 결제를 진행할 수 있어요"
      : mockPaymentMode
        ? "테스트 결제 모드입니다"
        : undefined;

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

  return (
    <div
      className={summaryOpen ? "sticky-cta expanded" : "sticky-cta"}
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
        {selectionReady && paymentAvailable && onPaymentMethodChange && (
          <div className="payment-method-options" role="radiogroup" aria-label="결제수단 선택">
            <label className={paymentMethod === "CARD" ? "payment-method-option active" : "payment-method-option"}>
              <input
                type="radio"
                name="quote-payment-method"
                value="CARD"
                checked={paymentMethod === "CARD"}
                onChange={() => onPaymentMethodChange("CARD")}
              />
              <span className="payment-method-check" aria-hidden="true">✓</span>
              <span>카드·간편결제</span>
            </label>
            <label className={paymentMethod === "TRANSFER" ? "payment-method-option active" : "payment-method-option"}>
              <input
                type="radio"
                name="quote-payment-method"
                value="TRANSFER"
                checked={paymentMethod === "TRANSFER"}
                onChange={() => onPaymentMethodChange("TRANSFER")}
              />
              <span className="payment-method-check" aria-hidden="true">✓</span>
              <span>계좌이체</span>
            </label>
          </div>
        )}
        <label className="payment-consent">
          <input type="checkbox" checked={policyAccepted} onChange={(event) => setPolicyAccepted(event.target.checked)} />
          <span>
            주문 내용과 방문 일정, <a href="/privacy" target="_blank" rel="noreferrer">개인정보 처리방침</a>,{" "}
            <a href="/refund-policy" target="_blank" rel="noreferrer">취소·환불 안내</a>를 확인했습니다.
          </span>
        </label>
        <button
          type="button"
          disabled={paymentDisabled}
          title={paymentTitle}
          className="strong payment-button"
          onClick={onPayment}
        >
          {loading ? "결제창 여는 중..." : paymentAvailable ? `${policyAccepted ? (mockPaymentMode ? "테스트 결제하기" : paymentButtonLabel) : "안내 확인 후 결제"}` : "결제 준비 중"}
        </button>
      </div>
    </div>
  );
}
