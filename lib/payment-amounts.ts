import { randomUUID } from "node:crypto";
import { formatServiceName } from "@/lib/format";
import { isProductSelectionService } from "@/lib/replacement-products";

export type PreparedPaymentAmounts = {
  productAmount: number;
  serviceFeeAmount: number;
  totalAmount: number;
  onlinePaymentAmount: number;
  onsitePaymentAmount: number;
  isProductSelectionQuote: boolean;
};

function asArray(value: unknown): Record<string, any>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, any> => item && typeof item === "object") : [];
}

function asPositiveInteger(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

export function quoteServiceCode(item: Record<string, any>) {
  return item?.sku ?? item?.metadata?.service_type_code ?? item?.metadata?.selected_replacement_product_service_code ?? null;
}

export function isProductSelectionQuote(quote: Record<string, any>) {
  const items = asArray(quote?.items);
  return items.length > 0 && items.every((item) => {
    const serviceCode = quoteServiceCode(item);
    return typeof serviceCode === "string" && isProductSelectionService(serviceCode);
  });
}

export function calculatePreparedPaymentAmounts(quote: Record<string, any>): PreparedPaymentAmounts {
  const totalAmount = asPositiveInteger(quote?.total_final);
  const isProductSelection = isProductSelectionQuote(quote);
  const productAmount = isProductSelection ? asPositiveInteger(quote?.total_material) : totalAmount;
  const serviceFeeAmount = isProductSelection
    ? Math.max(
        0,
        asPositiveInteger(quote?.total_labor) + asPositiveInteger(quote?.visit_fee) - asPositiveInteger(quote?.discount)
      )
    : 0;

  return {
    productAmount,
    serviceFeeAmount,
    totalAmount,
    onlinePaymentAmount: productAmount,
    onsitePaymentAmount: serviceFeeAmount,
    isProductSelectionQuote: isProductSelection
  };
}

function selectedProductLabel(item: Record<string, any>) {
  const selected =
    item?.metadata?.selected_replacement_product ??
    item?.metadata?.selected_toilet_product ??
    item?.metadata?.selected_replacement_product_snapshot;
  const brand = typeof selected?.brand === "string" ? selected.brand.trim() : "";
  const model = typeof selected?.model === "string" ? selected.model.trim() : "";
  const fallback = typeof item?.item_name === "string" ? item.item_name.trim() : "";
  return [brand, model].filter(Boolean).join(" ") || fallback;
}

export function buildPaymentOrderName(order: Record<string, any>, quote: Record<string, any>) {
  const serviceName = formatServiceName(order?.service_type_code ?? quoteServiceCode(asArray(quote?.items)[0]));
  const items = asArray(quote?.items);
  const productLabels = Array.from(new Set(items.map(selectedProductLabel).filter(Boolean)));

  if (productLabels.length === 0) return serviceName;
  if (productLabels.length === 1) return `${serviceName} · ${productLabels[0]}`;
  return `${serviceName} · ${productLabels[0]} 외 ${productLabels.length - 1}개`;
}

export function createPaymentOrderId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const nonce = randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase();
  return `BLC_${timestamp}_${nonce}`;
}
