export const QUOTE_VAT_RATE = 0.1;
const QUOTE_ROUND_UNIT = 1000;
const QUOTE_VAT_NUMERATOR = 110;
const QUOTE_VAT_DENOMINATOR = 100;

export function quoteSubtotalAmount(productAmount: number, laborAmount: number, visitFee = 0, discount = 0) {
  return Math.max(
    0,
    Math.round(Number(productAmount || 0) + Number(laborAmount || 0) + Number(visitFee || 0) - Number(discount || 0))
  );
}

export function quoteRoundUpToThousand(amount: number) {
  const value = Number(amount || 0);
  return value > 0 ? Math.ceil(value / QUOTE_ROUND_UNIT) * QUOTE_ROUND_UNIT : 0;
}

export function quoteRoundDownToThousand(amount: number) {
  const value = Number(amount || 0);
  return value > 0 ? Math.floor(value / QUOTE_ROUND_UNIT) * QUOTE_ROUND_UNIT : 0;
}

function quoteVatRawAmount(subtotalAmount: number) {
  const value = Number(subtotalAmount || 0);
  return value > 0 ? Math.round((value * QUOTE_VAT_NUMERATOR) / QUOTE_VAT_DENOMINATOR) : 0;
}

export function quoteVatIncludedAmount(subtotalAmount: number) {
  return quoteRoundUpToThousand(quoteVatRawAmount(subtotalAmount));
}

export function quoteVatIncludedLaborAmount(subtotalAmount: number) {
  return quoteRoundDownToThousand(quoteVatRawAmount(subtotalAmount));
}
