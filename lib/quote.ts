import { DEFAULT_VISIT_FEE } from "@/lib/constants";
import { isProductSelectionService } from "@/lib/replacement-products";
import type { QuoteInputItem, QuoteResult } from "@/lib/types";

function defaultVisitFeeForItems(items: QuoteInputItem[]) {
  const isProductOnly = items.length > 0 && items.every((item) => isProductSelectionService(item.service_type_code));
  return isProductOnly ? 0 : DEFAULT_VISIT_FEE;
}

export function calculateQuote(items: QuoteInputItem[], visitFee?: number): QuoteResult {
  const effectiveVisitFee = visitFee ?? defaultVisitFeeForItems(items);
  const lines = items.map((item) => {
    const optionTotal = (item.options ?? []).reduce((sum, option) => sum + option.price_delta, 0) * item.qty;
    const baseTotal = item.unit_price * item.qty;
    const lineTotal = baseTotal + optionTotal;
    const optionSummary =
      item.options && item.options.length > 0
        ? item.options.map((option) => `${option.name} +${option.price_delta}`).join(", ")
        : null;

    return {
      product_id: item.product_id,
      item_name: item.item_name,
      option_summary: optionSummary,
      qty: item.qty,
      unit_price: item.unit_price,
      option_total: optionTotal,
      line_total: lineTotal,
      metadata: {
        ...(item.metadata ?? {}),
        service_type_code: item.service_type_code,
        options: item.options ?? []
      }
    };
  });

  const subtotalAmount = lines.reduce((sum, line) => sum + line.line_total, 0);
  const optionTotal = lines.reduce((sum, line) => sum + line.option_total, 0);

  return {
    visit_fee: effectiveVisitFee,
    subtotal_amount: subtotalAmount,
    option_total: optionTotal,
    total_amount: subtotalAmount + effectiveVisitFee,
    items: lines
  };
}
