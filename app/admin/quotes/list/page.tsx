import Link from "next/link";
import { formatKRDateTime, formatKRW, formatOrderStatus, formatServiceName } from "@/lib/format";
import { LocalQuoteDraftsClient } from "./local-quote-drafts-client";
import { ManualQuoteConvertButton, ManualQuoteDeleteButton } from "./manual-quote-convert-button";
import {
  customerName,
  customerPhone,
  getManualQuotes,
  getQuoteOrders,
  latestQuote,
  quoteNeeded,
  selectedProductSummary
} from "../quote-page-data";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

function QuoteListRow({ order, selected }: { order: any; selected?: boolean }) {
  const quote = latestQuote(order);
  const amount = Number(quote?.total_final ?? order?.total_amount ?? 0);
  const mode = quoteNeeded(order) ? "작성" : "수정";

  return (
    <article className={`adm-order-queue-card ${selected ? "adm-order-queue-card-selected" : ""}`}>
      <div className="adm-order-queue-main">
        <div className="adm-order-queue-title">
          <strong>{order.order_number}</strong>
          <span className={`adm-badge ${quoteNeeded(order) ? "adm-badge-orange" : "adm-badge-blue"}`}>
            {quoteNeeded(order) ? "견적 필요" : "견적 작성됨"}
          </span>
          <span className="adm-badge adm-badge-gray">{formatOrderStatus(order.status)}</span>
        </div>
        <strong>{selectedProductSummary(order)}</strong>
        <p>{customerName(order)} · {customerPhone(order)}</p>
      </div>
      <div className="adm-order-queue-meta">
        <span>
          <b>서비스</b>
          <strong>{formatServiceName(order?.service_type_code)}</strong>
          <small>주문 기준</small>
        </span>
        <span>
          <b>견적 금액</b>
          <strong>{amount ? formatKRW(amount) : "미작성"}</strong>
          <small>{quote ? `${quote.version ?? 1}차 견적` : "견적 작성 필요"}</small>
        </span>
        <span>
          <b>작성 시각</b>
          <strong>{formatKRDateTime(quote?.accepted_at ?? quote?.created_at ?? order?.created_at)}</strong>
          <small>{quote ? "최신 견적" : "주문 접수"}</small>
        </span>
      </div>
      <div className="adm-order-queue-actions">
        <Link className="adm-btn adm-btn-primary" href={`/admin/quotes?orderId=${encodeURIComponent(order.id)}`}>
          이 주문으로 {mode}
        </Link>
        <Link className="adm-btn adm-btn-secondary" href={`/admin/orders/${order.id}`}>
          주문 상세
        </Link>
      </div>
    </article>
  );
}

function manualQuoteSummary(quote: any) {
  const items = Array.isArray(quote?.items) ? quote.items : [];
  if (items.length === 0) return "수동 견적 항목 없음";

  const first = items[0];
  const product = first?.metadata?.selected_replacement_product ?? {};
  const label = [product?.brand, product?.model].filter(Boolean).join(" ").trim() || first?.item_name || "선택 제품";
  return items.length > 1 ? `${label} 외 ${items.length - 1}개` : `${label} × ${Number(first?.qty ?? 1)}개`;
}

function ManualQuoteListRow({ quote }: { quote: any }) {
  return (
    <article className="adm-order-queue-card">
      <div className="adm-order-queue-main">
        <div className="adm-order-queue-title">
          <strong>{quote.quote_number}</strong>
          <span className="adm-badge adm-badge-blue">수동 견적</span>
          {quote.converted_order_id ? <span className="adm-badge adm-badge-green">제품 주문 전환됨</span> : null}
        </div>
        <strong>{manualQuoteSummary(quote)}</strong>
        <p>{quote.customer_name || "-"} · {quote.customer_phone || "-"}</p>
        <p>{quote.address_text || "주소 확인 중"}</p>
      </div>
      <div className="adm-order-queue-meta">
        <span>
          <b>제품값</b>
          <strong>{formatKRW(Number(quote.total_material ?? 0))}</strong>
          <small>수동 작성</small>
        </span>
        <span>
          <b>견적 금액</b>
          <strong>{formatKRW(Number(quote.total_final ?? 0))}</strong>
          <small>최종 견적</small>
        </span>
        <span>
          <b>수정 시각</b>
          <strong>{formatKRDateTime(quote.updated_at ?? quote.created_at)}</strong>
          <small>관리자 작성</small>
        </span>
      </div>
      <div className="adm-order-queue-actions">
        <Link className="adm-btn adm-btn-primary" href={`/admin/quotes?manualQuoteId=${encodeURIComponent(quote.id)}`}>
          수정
        </Link>
        {quote.converted_order_id ? (
          <Link className="adm-btn adm-btn-secondary" href={`/admin/orders/${quote.converted_order_id}`}>
            제품 주문 보기
          </Link>
        ) : (
          <ManualQuoteConvertButton quoteId={quote.id} />
        )}
        <ManualQuoteDeleteButton quoteId={quote.id} quoteNumber={quote.quote_number} />
      </div>
    </article>
  );
}

export default async function AdminQuoteListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { localMode, error, quoteTargets, quotedOrders } = await getQuoteOrders();
  const { error: manualQuoteError, manualQuotes } = await getManualQuotes();
  const allOrders = [...quoteTargets, ...quotedOrders];
  const selectedOrderId = params.orderId;
  const quotedTotal = quotedOrders.reduce((sum, order) => sum + Number(latestQuote(order)?.total_final ?? order?.total_amount ?? 0), 0);
  const manualTotal = manualQuotes.reduce((sum, quote) => sum + Number(quote?.total_final ?? 0), 0);

  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">견적서 목록</h1>
        <p className="adm-page-sub">견적 작성 대상과 작성 완료 견적을 분리해서 관리합니다.</p>
      </header>
      <div className="adm-content adm-stack">
        {localMode ? (
          <section className="adm-card adm-admin-warning" role="status">
            <strong>로컬 확인 모드입니다.</strong>
            <p>현재 브라우저 세션에 있는 주문 기준으로 견적 목록을 확인합니다.</p>
          </section>
        ) : null}

        {error ? (
          <section className="adm-card adm-admin-error">
            <strong>견적 대상 주문을 불러오지 못했습니다.</strong>
            <p>{error}</p>
          </section>
        ) : null}

        {manualQuoteError ? (
          <section className="adm-card adm-admin-error">
            <strong>수동 견적 목록을 불러오지 못했습니다.</strong>
            <p>{manualQuoteError}</p>
          </section>
        ) : null}

        <section className="adm-card adm-quote-list-section">
          <div className="adm-section-head">
            <div>
              <h2 className="adm-card-title">견적서 목록</h2>
              <p className="adm-muted">목록에서 주문을 선택하면 견적서 작성 화면으로 이동합니다.</p>
            </div>
            <Link className="adm-btn adm-btn-primary adm-btn-sm" href="/admin/quotes">
              견적서 작성
            </Link>
          </div>
          <div className="adm-quote-summary-strip">
            <span><b>작성 대상</b><strong>{quoteTargets.length}건</strong></span>
            <span><b>작성 완료</b><strong>{quotedOrders.length}건</strong></span>
            <span><b>수동 견적</b><strong>{manualQuotes.length}건</strong></span>
            <span><b>견적 합계</b><strong>{formatKRW(quotedTotal + manualTotal)}</strong></span>
            <span><b>관리 화면</b><strong>목록</strong></span>
          </div>
          <div className="adm-order-queue-list">
            {manualQuotes.length > 0 || allOrders.length > 0 ? (
              <>
                {manualQuotes.map((quote) => <ManualQuoteListRow key={quote.id} quote={quote} />)}
                {allOrders.map((order) => <QuoteListRow key={order.id} order={order} selected={order.id === selectedOrderId} />)}
              </>
            ) : (
              <div className="adm-empty adm-empty-line">
                <div className="adm-empty-title">{localMode ? "현재 브라우저 세션에 주문이 없습니다." : "견적서 목록에 표시할 주문이 없습니다."}</div>
              </div>
            )}
          </div>
        </section>

        {localMode ? <LocalQuoteDraftsClient /> : null}
      </div>
    </>
  );
}
