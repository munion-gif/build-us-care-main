"use client";

import { useState } from "react";

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
  onPayment
}: QuoteStickySummaryProps) {
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const visitText = date ? `${date} ${slotLabel(slot)}` : "방문일 선택 전";
  const paymentDisabled = loading || !paymentAvailable || !policyAccepted;
  const paymentTitle = !paymentAvailable
    ? "결제 모듈 준비 중입니다"
    : !policyAccepted
      ? "필수 안내를 확인하면 결제를 진행할 수 있어요"
      : mockPaymentMode
        ? "테스트 결제 모드입니다"
        : undefined;

  return (
    <div className="sticky-cta">
      <div className="sticky-cta-head">
        <span>결제 요약</span>
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
      {!paymentAvailable && <p className="sticky-message">결제 기능은 곧 연결됩니다. 지금은 카톡 상담으로 예약 가능합니다.</p>}
      {paymentAvailable && <p className="sticky-message">{mockPaymentMode ? "테스트 결제 모드입니다." : "결제 후 방문 일정이 확정됩니다."}</p>}
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
        {paymentAvailable ? `${policyAccepted ? (mockPaymentMode ? "테스트 결제" : "결제 진행하기") : "안내 확인 후 결제"} · ${total}` : "결제 준비 중"}
      </button>
    </div>
  );
}
