import { SERVICE_NAME_BY_CODE } from "@/lib/service-catalog";
export { SERVICE_NAME_BY_CODE } from "@/lib/service-catalog";

const ORDER_STATUS_LABELS: Record<string, string> = {
  inquiry: "문의 접수",
  quoted: "견적 완료",
  submitted: "문의 접수",
  draft: "문의 접수",
  reservation_pending: "예약 대기",
  payment_pending: "결제대기",
  paid: "결제완료",
  assigned: "기사배정",
  scheduled: "방문확정",
  reservation_confirmed: "방문확정",
  preparing: "방문확정",
  in_progress: "시공중",
  in_service: "시공중",
  completed: "검수대기",
  done: "완료",
  inspected: "검수완료",
  issue: "이슈",
  warranty: "A/S",
  cancel_requested: "취소요청",
  canceled: "취소",
  cancelled: "취소"
};

const CHANNEL_LABELS: Record<string, string> = {
  web: "웹",
  kakao: "카카오",
  phone: "전화",
  store: "매장",
  instagram: "인스타그램"
};

const HOUSING_TYPE_LABELS: Record<string, string> = {
  owner: "자가",
  self: "자가",
  jeonse: "전세",
  monthly_rent: "월세",
  monthly: "월세",
  other: "기타",
  unknown: "미확인"
};

const BUILDING_TYPE_LABELS: Record<string, string> = {
  apartment: "아파트",
  villa: "빌라",
  house: "단독주택",
  officetel: "오피스텔",
  commercial: "상가",
  unknown: "미확인"
};

export function formatServiceName(code?: string | null): string {
  if (!code) return "시공 서비스";
  return SERVICE_NAME_BY_CODE[code] ?? code;
}

export function formatOrderStatus(status?: string | null): string {
  if (!status) return "미확인";
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function formatChannel(channel?: string | null): string {
  if (!channel) return "-";
  return CHANNEL_LABELS[channel] ?? channel;
}

export function formatHousingType(type?: string | null): string {
  if (!type) return "-";
  return HOUSING_TYPE_LABELS[type] ?? type;
}

export function formatBuildingType(type?: string | null): string {
  if (!type) return "-";
  return BUILDING_TYPE_LABELS[type] ?? type;
}

export function formatKRW(amount?: number | null): string {
  return `${Number(amount ?? 0).toLocaleString("ko-KR")}원`;
}

export function formatKRDate(iso?: string | null): string {
  if (!iso) return "확인 중";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
}

export function formatKRDateTime(iso?: string | null): string {
  if (!iso) return "확인 중";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(iso));
}
