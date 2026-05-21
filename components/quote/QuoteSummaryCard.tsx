"use client";

type QuoteSummaryCardProps = {
  serviceName: string;
  materialName?: string | null;
  addonCount: number;
  laborPrice: number;
  materialPrice: number;
  addonTotal: number;
  visitFee: number;
  date?: string;
  slot?: string;
  photoCount: number;
};

function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function slotLabel(slot?: string) {
  if (slot === "morning") return "오전";
  if (slot === "afternoon") return "오후";
  return "시간 선택 전";
}

export function QuoteSummaryCard({
  serviceName,
  materialName,
  addonCount,
  laborPrice,
  materialPrice,
  addonTotal,
  visitFee,
  date,
  slot,
  photoCount
}: QuoteSummaryCardProps) {
  const total = laborPrice + materialPrice + addonTotal + visitFee;

  return (
    <section className="quote-section price-summary quote-summary-card">
      <div className="section-title-row">
        <h2>결제 전 요약</h2>
        <span>실시간 계산</span>
      </div>
      <div className="quote-summary-head">
        <div>
          <span>선택 작업</span>
          <strong>{serviceName}</strong>
          <p>{materialName ?? "자재 선택 전"} · 옵션 {addonCount}개 · 사진 {photoCount}장</p>
        </div>
        <strong>{won(total)}</strong>
      </div>
      <dl className="price-lines">
        <div><dt>시공비</dt><dd>{won(laborPrice)}</dd></div>
        <div><dt>자재비</dt><dd>{won(materialPrice)}</dd></div>
        <div><dt>추가 옵션</dt><dd>{won(addonTotal)}</dd></div>
        <div><dt>출장비</dt><dd>{won(visitFee)}</dd></div>
        <div><dt>방문 일정</dt><dd>{date ? `${date} ${slotLabel(slot)}` : "선택 전"}</dd></div>
      </dl>
      <div className="quote-payment-notes" aria-label="결제 전 안내">
        <p>결제 후 주문 링크에서 기사 배정과 방문 상태를 확인할 수 있어요.</p>
        <p>현장 조건이 달라 추가 비용이 필요한 경우, 작업 전 먼저 안내합니다.</p>
        <p>시공 완료 후 A/S 접수도 같은 주문 링크에서 가능합니다.</p>
      </div>
    </section>
  );
}
