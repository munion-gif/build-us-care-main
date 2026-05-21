"use client";

import { formatKRDate, formatKRW } from "@/lib/format";

type QuoteSummaryProps = {
  quote?: {
    version?: number;
    total_final?: number;
    accepted_at?: string | null;
  } | null;
  payment?: {
    provider?: string | null;
    amount?: number | null;
    status?: string | null;
    paid_at?: string | null;
    approved_at?: string | null;
  } | null;
};

function paymentMethodLabel(provider?: string | null) {
  if (provider === "toss") return "카드/간편결제";
  return provider ?? "확인 중";
}

export function QuoteSummary({ quote, payment }: QuoteSummaryProps) {
  return (
    <section className="order-card">
      <h2>결제/견적 정보</h2>
      <dl className="summary-list">
        <div>
          <dt>총 결제 금액</dt>
          <dd>{payment?.amount ? formatKRW(Number(payment.amount)) : quote?.total_final ? formatKRW(Number(quote.total_final)) : "확인 중"}</dd>
        </div>
        <div>
          <dt>결제 수단</dt>
          <dd>{paymentMethodLabel(payment?.provider)}</dd>
        </div>
        <div>
          <dt>결제 기준일</dt>
          <dd>{formatKRDate(payment?.paid_at ?? payment?.approved_at ?? quote?.accepted_at)}</dd>
        </div>
        <div>
          <dt>견적 버전</dt>
          <dd>{quote?.version ? `${quote.version}차 견적` : "-"}</dd>
        </div>
      </dl>
    </section>
  );
}
