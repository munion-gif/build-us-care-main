import { SILICONE_REPAIR_LABOR_PRICE } from "@/lib/constants";
import { canonicalServiceCode } from "@/lib/service-catalog";
import { formatKRW } from "@/lib/format";

export function isSiliconeLaborService(serviceCode?: string | null) {
  return canonicalServiceCode(serviceCode) === "silicone_repair";
}

export function laborUnitLabel(serviceCode?: string | null) {
  return isSiliconeLaborService(serviceCode) ? "m" : "개";
}

export function laborQtyText(serviceCode: string | null | undefined, qty: number, prefix = "×") {
  const unit = laborUnitLabel(serviceCode);
  return isSiliconeLaborService(serviceCode) ? `${prefix}${qty}${unit}` : `${prefix}${qty}`;
}

export function laborFeeLabel(label: string, serviceCode?: string | null) {
  if (!isSiliconeLaborService(serviceCode)) return `시공비 · ${label}`;
  return `시공비 · ${label} (1m당 ${formatKRW(SILICONE_REPAIR_LABOR_PRICE)})`;
}

export function laborUnitHelpText(serviceCode?: string | null) {
  if (!isSiliconeLaborService(serviceCode)) return "";
  return `실리콘 시공비는 1m당 ${formatKRW(SILICONE_REPAIR_LABOR_PRICE)} 기준입니다.`;
}
