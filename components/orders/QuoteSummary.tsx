"use client";

import { formatKRDate, formatKRW } from "@/lib/format";
import { isSiliconeLaborService, laborUnitHelpText } from "@/lib/builduscare-labor";

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
  onDownloadQuote?: () => void | Promise<void>;
  downloadLoading?: boolean;
};

type QuoteSummaryItem = {
  sku?: string | null;
  item_name?: string | null;
  qty?: number | null;
  unit_material?: number | null;
  unit_labor?: number | null;
  line_total?: number | null;
  service_type_code?: string | null;
  metadata?: {
    service_type_code?: string | null;
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
  if (provider === "bank_transfer") return "계좌이체";
  return provider ?? "확인 중";
}

function quoteItemRows(items: QuoteSummaryItem[] | undefined) {
  return (items ?? []).map((item, index) => {
    const product = item.metadata?.selected_replacement_product ?? null;
    const productName = [product?.brand, product?.model].filter(Boolean).join(" ").trim() || item.item_name || "선택 제품";
    const unitPrice = Number(product?.price ?? item.unit_material ?? 0);
    const laborPrice = Number(item.unit_labor ?? 0) * Number(item.qty ?? 1);
    const finalPrice = Number(item.line_total ?? (unitPrice + Number(item.unit_labor ?? 0)) * Number(item.qty ?? 1));
    const serviceCode = item.service_type_code ?? item.metadata?.service_type_code ?? "";

    return {
      id: `${product?.sku ?? item.sku ?? "quote"}-${index}`,
      image: product?.image ?? null,
      productName,
      sku: product?.sku ?? item.sku ?? "-",
      unitPrice,
      laborPrice,
      finalPrice,
      serviceCode,
      qty: Number(item.qty ?? 1)
    };
  });
}

export function QuoteSummary({ quote, payment, onDownloadQuote, downloadLoading = false }: QuoteSummaryProps) {
  const items = quoteItemRows(quote?.items);

  return (
    <section className="order-card">
      <div className="quote-summary-head">
        <h2>결제/견적 정보</h2>
        {onDownloadQuote && (
          <button className="quote-download-button" type="button" onClick={onDownloadQuote} disabled={downloadLoading || !quote}>
            {downloadLoading ? "준비 중..." : "견적서 다운로드"}
          </button>
        )}
      </div>
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
                <strong>{item.productName}{item.qty > 1 ? ` · ${isSiliconeLaborService(item.serviceCode) ? `${item.qty}m` : `${item.qty}개`}` : ""}</strong>
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
                    <dt>시공비</dt>
                    <dd>{formatKRW(item.laborPrice)}</dd>
                  </div>
                  {isSiliconeLaborService(item.serviceCode) ? (
                    <div>
                      <dt>기준</dt>
                      <dd>{laborUnitHelpText(item.serviceCode)}</dd>
                    </div>
                  ) : null}
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
