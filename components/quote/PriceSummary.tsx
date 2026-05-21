"use client";

type PriceSummaryProps = {
  laborPrice: number;
  materialPrice: number;
  addonTotal: number;
  visitFee: number;
};

function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function PriceSummary({ laborPrice, materialPrice, addonTotal, visitFee }: PriceSummaryProps) {
  const total = laborPrice + materialPrice + addonTotal + visitFee;

  return (
    <section className="quote-section price-summary">
      <div className="section-title-row">
        <h2>가격 상세</h2>
        <span>실시간 계산</span>
      </div>
      <dl className="price-lines">
        <div>
          <dt>시공비</dt>
          <dd>{won(laborPrice)}</dd>
        </div>
        <div>
          <dt>자재비</dt>
          <dd>{won(materialPrice)}</dd>
        </div>
        <div>
          <dt>추가 옵션</dt>
          <dd>{won(addonTotal)}</dd>
        </div>
        <div>
          <dt>출장비</dt>
          <dd>{won(visitFee)}</dd>
        </div>
      </dl>
      <div className="price-total">
        <span>합계</span>
        <strong>{won(total)}</strong>
      </div>
    </section>
  );
}
