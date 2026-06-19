import Link from "next/link";
import { OrderQuoteEditor } from "../../orders/order-quote-editor-client";
import { formatKRDateTime, formatKRW, formatOrderStatus, formatServiceName } from "@/lib/format";
import {
  buildAdminQuoteCatalogs,
  customerName,
  customerPhone,
  firstServiceCode,
  getQuoteOrders,
  initialQuoteItems,
  latestQuote,
  orderScheduleDate,
  orderScheduleTime,
  quoteNeeded,
  selectedProductSummary
} from "../quote-page-data";
import { isProductSelectionService } from "@/lib/replacement-products";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

function QuotePickRow({ order, selected }: { order: any; selected?: boolean }) {
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
          <small>주문 기준 서비스 코드</small>
        </span>
        <span>
          <b>견적 금액</b>
          <strong>{formatKRW(amount)}</strong>
          <small>{quote ? `${quote.version ?? 1}차 견적` : "미작성"}</small>
        </span>
        <span>
          <b>작성 시각</b>
          <strong>{formatKRDateTime(quote?.accepted_at ?? quote?.created_at ?? order?.created_at)}</strong>
          <small>{quote ? "최신 견적 기준" : "주문 접수 시각"}</small>
        </span>
      </div>
      <div className="adm-order-queue-actions">
        <Link className="adm-btn adm-btn-primary" href={`/admin/quotes/new?orderId=${encodeURIComponent(order.id)}`}>
          이 주문으로 {mode}
        </Link>
        <Link className="adm-btn adm-btn-secondary" href={`/admin/orders/${order.id}`}>
          주문 상세
        </Link>
      </div>
    </article>
  );
}

export default async function AdminQuoteNewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { localMode, error, quoteTargets, quotedOrders } = await getQuoteOrders();
  const allOrders = [...quoteTargets, ...quotedOrders];
  const selectedOrderId = params.orderId;
  const selectedOrder = allOrders.find((order) => order.id === selectedOrderId) ?? quoteTargets[0] ?? quotedOrders[0] ?? null;
  const quoteCatalogs = buildAdminQuoteCatalogs();
  const initialServiceCode = selectedOrder && isProductSelectionService(firstServiceCode(selectedOrder)) ? String(firstServiceCode(selectedOrder)) : "toilet_replace";
  const quoteEditorItems = selectedOrder ? initialQuoteItems(selectedOrder, initialServiceCode) : [];
  const currentQuote = selectedOrder ? latestQuote(selectedOrder) : null;
  const initialVisitFee = Number((selectedOrder as any)?.visit_fee ?? (currentQuote as any)?.visit_fee ?? (selectedOrder as any)?.visitFee ?? 0);
  const initialDiscount = selectedOrder ? Number(currentQuote?.discount ?? 0) : 0;

  const selectedOrderHome = selectedOrder ? ((Array.isArray((selectedOrder as any)?.homes) ? (selectedOrder as any).homes[0] : (selectedOrder as any)?.homes) ?? null) : null;

  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">견적서 작성</h1>
        <p className="adm-page-sub">주문을 선택하고 바로 견적서를 작성하거나 수정합니다.</p>
      </header>
      <div className="adm-content adm-stack">
        {localMode ? (
          <section className="adm-card adm-admin-warning" role="status">
            <strong>로컬 확인 모드입니다.</strong>
            <p>현재 브라우저 세션에 있는 주문 기준으로 견적 작성/수정이 가능합니다.</p>
          </section>
        ) : null}

        {error ? (
          <section className="adm-card adm-admin-error">
            <strong>견적 대상 주문을 불러오지 못했습니다.</strong>
            <p>{error}</p>
          </section>
        ) : null}

        <section className="adm-card">
          <div className="adm-section-head">
            <div>
              <h2 className="adm-card-title">견적 작성 폼</h2>
              <p className="adm-muted">주문을 고르면 아래 폼에 고객 정보가 채워지고, 바로 견적서를 작성합니다.</p>
            </div>
          </div>
          <OrderQuoteEditor
            orderId={selectedOrder?.id ?? null}
            orderNumber={selectedOrder?.order_number ?? null}
            catalogs={quoteCatalogs as any}
            initialItems={quoteEditorItems as any}
            initialVisitFee={initialVisitFee}
            initialDiscount={initialDiscount}
            initialScheduleDate={selectedOrder ? orderScheduleDate(selectedOrder) : null}
            initialScheduleTime={selectedOrder ? orderScheduleTime(selectedOrder) as any : null}
            initialServiceCode={initialServiceCode}
            currentQuoteVersion={currentQuote?.version ?? null}
            customerName={selectedOrder ? customerName(selectedOrder) : null}
            customerPhone={selectedOrder ? customerPhone(selectedOrder) : null}
            addressText={selectedOrder ? (selectedOrderHome?.address_full ?? (selectedOrder as any)?.roadAddress ?? null) : null}
            editableCustomerFields
            localMode={localMode}
          />
        </section>

        <section className="adm-card">
          <div className="adm-section-head">
            <div>
              <h2 className="adm-card-title">주문 선택</h2>
              <p className="adm-muted">고객 주문을 선택하면 해당 주문 기준으로 견적을 작성하거나 수정합니다.</p>
            </div>
          </div>
          <div className="adm-order-queue-list">
            {allOrders.length > 0 ? (
              allOrders.map((order) => <QuotePickRow key={order.id} order={order} selected={selectedOrder?.id === order.id} />)
            ) : (
              <div className="adm-empty adm-empty-line">
                <div className="adm-empty-title">{localMode ? "현재 브라우저 세션에 주문이 없습니다. 위 폼에 고객 정보를 직접 입력해서 견적서를 먼저 작성할 수 있습니다." : "선택할 주문이 없습니다."}</div>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
