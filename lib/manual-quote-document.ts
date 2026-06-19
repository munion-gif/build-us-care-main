import { formatServiceName } from "@/lib/format";
import type { QuoteDocumentInput } from "@/lib/quote-document";

export function buildManualQuoteDocumentInput(quote: any): QuoteDocumentInput {
  const rows = Array.isArray(quote?.items) ? quote.items : [];
  const firstServiceCode = String(rows[0]?.metadata?.service_type_code ?? rows[0]?.sku ?? "manual_quote");

  return {
    orderNumber: quote?.quote_number ?? "수동 견적서",
    customerName: quote?.customer_name ?? null,
    customerPhone: quote?.customer_phone ?? null,
    serviceName: firstServiceCode,
    rows: rows.map((item: any, index: number) => {
      const product = item?.metadata?.selected_replacement_product_snapshot ?? item?.metadata?.selected_replacement_product ?? {};
      return {
        id: `${item?.sku ?? "manual"}-${index}`,
        image: typeof product?.image === "string" ? product.image : null,
        productName: [product?.brand, product?.model].filter(Boolean).join(" ").trim() || item?.item_name || "선택 제품",
        sku: typeof product?.sku === "string" ? product.sku : item?.sku ?? "-",
        categoryLabel: formatServiceName(String(item?.metadata?.service_type_code ?? item?.sku ?? "")),
        qty: Number(item?.qty ?? 1),
        price: Number(item?.line_material ?? 0),
        labor: Number(item?.line_labor ?? 0) + Number(item?.option_total ?? 0),
        finalPrice: Number(item?.line_total ?? 0)
      };
    }),
    address: quote?.address_text ?? "주소 확인 중",
    visitText: "방문일 확인 중",
    productTotal: Number(quote?.total_material ?? 0),
    laborTotal: Number(quote?.total_labor ?? 0),
    subtotalTotal: Math.max(
      0,
      Number(quote?.total_material ?? 0) + Number(quote?.total_labor ?? 0) + Number(quote?.visit_fee ?? 0) - Number(quote?.discount ?? 0)
    ),
    finalTotal: Number(quote?.total_final ?? 0),
    transferAmount: Number(quote?.total_material ?? 0),
    onsiteAmount: Math.max(0, Number(quote?.total_labor ?? 0) + Number(quote?.visit_fee ?? 0) - Number(quote?.discount ?? 0)),
    productCatalogMode: true,
    cashReceiptText: "미정"
  };
}
