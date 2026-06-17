import { OrderQuoteEditor } from "../orders/order-quote-editor-client";
import { isProductSelectionService } from "@/lib/replacement-products";
import {
  buildAdminQuoteCatalogs,
  customerName,
  customerPhone,
  firstServiceCode,
  getManualQuote,
  getQuoteOrders,
  initialQuoteItems,
  latestQuote,
  manualQuoteItems
} from "./quote-page-data";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

function orderHomeAddress(order: any) {
  const home = Array.isArray(order?.homes) ? order.homes[0] : order?.homes;
  return home?.address_full ?? order?.roadAddress ?? null;
}

export default async function AdminQuotesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { localMode, error, quoteTargets, quotedOrders } = await getQuoteOrders();
  const { error: manualQuoteError, manualQuote } = await getManualQuote(params.manualQuoteId);
  const allOrders = [...quoteTargets, ...quotedOrders];
  const selectedOrderId = params.orderId;
  const selectedOrder = params.draftId || params.manualQuoteId
    ? null
    : selectedOrderId
      ? allOrders.find((order) => order.id === selectedOrderId) ?? null
      : null;
  const quoteCatalogs = buildAdminQuoteCatalogs();
  const manualFirstServiceCode = String(manualQuote?.items?.[0]?.metadata?.service_type_code ?? manualQuote?.items?.[0]?.sku ?? "");
  const initialServiceCode =
    selectedOrder && isProductSelectionService(firstServiceCode(selectedOrder))
      ? String(firstServiceCode(selectedOrder))
      : manualQuote && isProductSelectionService(manualFirstServiceCode)
        ? manualFirstServiceCode
        : "toilet_replace";
  const quoteEditorItems = selectedOrder
    ? initialQuoteItems(selectedOrder, initialServiceCode)
    : manualQuote
      ? manualQuoteItems(manualQuote, initialServiceCode)
      : [];
  const currentQuote = selectedOrder ? latestQuote(selectedOrder) : null;
  const initialVisitFee = Number(manualQuote?.visit_fee ?? (selectedOrder as any)?.visit_fee ?? (currentQuote as any)?.visit_fee ?? (selectedOrder as any)?.visitFee ?? 0);
  const initialDiscount = selectedOrder
    ? Math.max(
        0,
        Number(currentQuote?.total_material ?? 0) + Number(currentQuote?.total_labor ?? 0) + initialVisitFee - Number(currentQuote?.total_final ?? selectedOrder?.total_amount ?? 0)
      )
    : Number(manualQuote?.discount ?? 0);

  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">견적서</h1>
        <p className="adm-page-sub">주문 기준으로 견적서를 작성하거나 수정합니다.</p>
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

        {manualQuoteError ? (
          <section className="adm-card adm-admin-error">
            <strong>수동 견적을 불러오지 못했습니다.</strong>
            <p>{manualQuoteError}</p>
          </section>
        ) : null}

        <section className="adm-card">
          <div className="adm-section-head">
            <div>
              <h2 className="adm-card-title">견적서 작성</h2>
              <p className="adm-muted">주문을 선택하면 고객 정보가 채워지고, 저장 전 미리보기로 견적서를 확인할 수 있습니다.</p>
            </div>
          </div>
          <OrderQuoteEditor
            orderId={selectedOrder?.id ?? null}
            manualQuoteId={manualQuote?.id ?? null}
            orderNumber={selectedOrder?.order_number ?? manualQuote?.quote_number ?? null}
            catalogs={quoteCatalogs as any}
            initialItems={quoteEditorItems as any}
            initialVisitFee={initialVisitFee}
            initialDiscount={initialDiscount}
            initialServiceCode={initialServiceCode}
            currentQuoteVersion={currentQuote?.version ?? null}
            customerName={selectedOrder ? customerName(selectedOrder) : manualQuote?.customer_name ?? null}
            customerPhone={selectedOrder ? customerPhone(selectedOrder) : manualQuote?.customer_phone ?? null}
            addressText={selectedOrder ? orderHomeAddress(selectedOrder) : manualQuote?.address_text ?? null}
            editableCustomerFields
            localMode={localMode}
          />
        </section>
      </div>
    </>
  );
}
