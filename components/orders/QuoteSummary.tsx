"use client";

import { formatKRDate, formatKRW } from "@/lib/format";

type QuoteSummaryProps = {
  quote?: {
    version?: number;
    total_final?: number;
    accepted_at?: string | null;
    items?: QuoteSummaryItem[];
  } | null;
  payment?: {
    provider?: string | null;
    amount?: number | null;
    status?: string | null;
    paid_at?: string | null;
    approved_at?: string | null;
  } | null;
};

type QuoteSummaryItem = {
  sku?: string | null;
  item_name?: string | null;
  qty?: number | null;
  unit_material?: number | null;
  unit_labor?: number | null;
  line_total?: number | null;
  metadata?: {
    selected_replacement_product?: {
      brand?: string | null;
      model?: string | null;
      sku?: string | null;
      price?: number | null;
      image?: string | null;
    } | null;
  } | null;
};

function paymentMethodLabel(provider?: string | null) {
  if (provider === "toss") return "카드/간편결제";
  return provider ?? "확인 중";
}

function quoteItemRows(items: QuoteSummaryItem[] | undefined) {
  return (items ?? []).map((item, index) => {
    const product = item.metadata?.selected_replacement_product ?? null;
    const productName = [product?.brand, product?.model].filter(Boolean).join(" ").trim() || item.item_name || "선택 제품";
    const unitPrice = Number(product?.price ?? item.unit_material ?? 0);
    const finalPrice = Number(item.line_total ?? (unitPrice + Number(item.unit_labor ?? 0)) * Number(item.qty ?? 1));

    return {
      id: `${product?.sku ?? item.sku ?? "quote"}-${index}`,
      image: product?.image ?? null,
      productName,
      sku: product?.sku ?? item.sku ?? "-",
      unitPrice,
      finalPrice,
      qty: Number(item.qty ?? 1)
    };
  });
}

export function QuoteSummary({ quote, payment }: QuoteSummaryProps) {
  const items = quoteItemRows(quote?.items);

  return (
    <section className="order-card">
      <h2>결제/견적 정보</h2>
      {items.length > 0 && (
        <ul className="quote-item-list" aria-label="견적 제품 목록">
          {items.map((item) => (
            <li key={item.id} className="quote-item-row">
              {item.image ? (
                <img src={item.image} alt="" aria-hidden="true" />
              ) : (
                <span className="quote-item-image-fallback" aria-hidden="true">사진</span>
              )}
              <div className="quote-item-body">
                <strong>{item.productName}{item.qty > 1 ? ` · ${item.qty}개` : ""}</strong>
                <dl>
                  <div>
                    <dt>품번</dt>
                    <dd>{item.sku}</dd>
                  </div>
                  <div>
                    <dt>가격</dt>
                    <dd>{formatKRW(item.unitPrice)}</dd>
                  </div>
                  <div>
                    <dt>최종가격</dt>
                    <dd>{formatKRW(item.finalPrice)}</dd>
                  </div>
                </dl>
              </div>
            </li>
          ))}
        </ul>
      )}
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
