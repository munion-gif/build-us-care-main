import { DEFAULT_VISIT_FEE } from "@/lib/constants";
import type { QuoteInputItem, QuoteResult } from "@/lib/types";

export function calculateQuote(items: QuoteInputItem[], visitFee = DEFAULT_VISIT_FEE): QuoteResult {
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
    visit_fee: visitFee,
    subtotal_amount: subtotalAmount,
    option_total: optionTotal,
    total_amount: subtotalAmount + visitFee,
    items: lines
  };
}
