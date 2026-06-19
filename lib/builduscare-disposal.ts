export const PRODUCT_DISPOSAL_FEE = 10000;
export const HEAVY_PRODUCT_DISPOSAL_FEE = 20000;

const HEAVY_DISPOSAL_SERVICE_CODES = new Set(["toilet_replace", "basin_replace"]);

export function productDisposalFee(serviceCode?: string | null) {
  return HEAVY_DISPOSAL_SERVICE_CODES.has(String(serviceCode ?? "")) ? HEAVY_PRODUCT_DISPOSAL_FEE : PRODUCT_DISPOSAL_FEE;
}
