import { SERVICE_NAME_BY_CODE } from "@/lib/service-catalog";
export { SERVICE_NAME_BY_CODE } from "@/lib/service-catalog";

const ORDER_STATUS_LABELS: Record<string, string> = {
  inquiry: "문의 접수",
  quoted: "견적 완료",
  submitted: "문의 접수",
  draft: "문의 접수",
  reservation_pending: "예약 대기",
  payment_pending: "입금확인대기",
  pending_product_payment: "제품값 입금확인대기",
  paid: "결제완료",
  product_paid: "제품값 결제완료",
  assigned: "기사배정",
  scheduled: "방문확정",
  reservation_confirmed: "방문확정",
  preparing: "방문확정",
  in_progress: "시공중",
  in_service: "시공중",
  completed: "검수대기",
  installation_completed: "시공완료",
  done: "완료",
  inspected: "검수완료",
  issue: "이슈",
  warranty: "A/S",
  cancel_requested: "취소요청",
  canceled: "취소",
  cancelled: "취소",
  refunded: "환불완료"
};

const CHANNEL_LABELS: Record<string, string> = {
  web: "웹",
  kakao: "카카오",
  phone: "전화",
  store: "매장",
  instagram: "인스타그램"
};

const ACQUISITION_SOURCE_LABELS: Record<string, string> = {
  builduscare: "Build us Care 웹",
  builduscare_static: "Build us Care 웹",
  builduscare_web: "Build us Care 웹",
  direct: "직접 유입",
  instagram: "인스타그램",
  kakao: "카카오톡",
  offline: "오프라인",
  organic: "검색 유입",
  phone: "전화",
  photo_diagnosis: "사진확인 접수",
  store: "오프라인",
  unknown: "미확인",
  web: "웹"
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "계좌이체",
  card: "카드결제",
  cash: "현장결제",
  cash_on_site: "현장결제",
  instapay: "간편결제",
  kakao_pay: "카카오페이",
  manual: "수동 확인",
  naver_pay: "네이버페이",
  onsite: "현장결제",
  toss_pay: "토스페이",
  transfer: "계좌이체",
  virtual_account: "가상계좌"
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

function humanizeToken(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

export function formatAcquisitionSource(source?: string | null): string {
  if (!source) return "-";
  const normalized = source.trim();
  return ACQUISITION_SOURCE_LABELS[normalized] ?? humanizeToken(normalized);
}

export function formatPaymentMethod(provider?: string | null, method?: string | null): string {
  const candidates = [provider, method]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (candidates.length === 0) return "-";
  for (const candidate of candidates) {
    if (PAYMENT_METHOD_LABELS[candidate]) return PAYMENT_METHOD_LABELS[candidate];
  }
  return humanizeToken(candidates[0]);
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
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(iso));
}

export function formatKRDateTime(iso?: string | null): string {
  if (!iso) return "확인 중";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(iso));
}
