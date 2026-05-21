type ApiErrorLike = {
  code?: string;
  message?: string;
};

const CUSTOMER_ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "입력한 내용을 다시 확인해주세요.",
  BAD_REQUEST: "요청 내용을 다시 확인해주세요.",
  UNAUTHORIZED: "로그인이 필요합니다.",
  FORBIDDEN: "확인 권한이 없습니다. 받은 링크를 다시 확인해주세요.",
  NOT_FOUND: "요청한 정보를 찾을 수 없어요.",
  CONFLICT: "이미 처리된 요청입니다. 화면을 새로고침한 뒤 다시 확인해주세요.",
  INTERNAL_ERROR: "일시적인 문제가 생겼어요. 잠시 후 다시 시도해주세요.",
  SUPABASE_NOT_CONFIGURED: "서비스 연결을 준비하고 있어요. 잠시 후 다시 시도해주세요.",
  CONFIGURATION_ERROR: "서비스 설정을 확인하는 중입니다. 잠시 후 다시 시도해주세요.",

  SLOT_FULL: "선택한 시간대는 마감되었습니다. 다른 시간대를 선택해주세요.",
  SLOT_CLOSED: "선택한 날짜는 예약이 마감되었습니다. 다른 날짜를 선택해주세요.",
  INVALID_DATE: "예약 가능한 날짜를 다시 선택해주세요.",
  ORDER_NOT_RESCHEDULABLE: "현재 상태에서는 예약을 변경할 수 없습니다.",
  JOB_ALREADY_STARTED: "시공이 시작된 주문은 예약 변경이 어렵습니다.",
  QUOTE_REQUIRED: "결제 전 견적 확인이 필요합니다. 다시 시도해주세요.",
  AMOUNT_MISMATCH: "결제 금액이 견적 금액과 다릅니다. 새로고침 후 다시 시도해주세요.",
  PAYMENT_ERROR: "결제가 승인되지 않았어요. 다시 시도해주세요.",
  ORDER_NOT_ELIGIBLE: "아직 후기를 작성할 수 없는 주문입니다.",
  ALREADY_SUBMITTED: "이미 후기가 접수되었습니다.",
  NPS_REQUIRED: "추천 점수를 선택해주세요.",
  NPS_INVALID: "추천 점수는 0점에서 10점 사이로 선택해주세요.",
  ORDER_NOT_COMPLETED: "시공 완료 후 A/S를 신청할 수 있어요.",
  PAYMENT_FAILED: "결제에 실패했어요. 다시 시도해주세요.",
  PAYMENT_AMOUNT_MISMATCH: "결제 금액이 견적 금액과 다릅니다. 새로고침 후 다시 시도해주세요.",
  PAYMENT_KEY_CONFLICT: "이미 다른 주문에 사용된 결제 정보입니다. 다시 결제해주세요."
};

function looksTechnical(message: string) {
  return /^[A-Z0-9_]+$/.test(message) || /[{}[\]<>]/.test(message) || /column|constraint|relation|syntax|uuid/i.test(message);
}

export function customerErrorMessage(error: ApiErrorLike | null | undefined, fallback = "요청을 다시 확인해주세요.") {
  const code = error?.code?.toUpperCase();
  if (code && CUSTOMER_ERROR_MESSAGES[code]) return CUSTOMER_ERROR_MESSAGES[code];

  const message = error?.message?.trim();
  if (message && !looksTechnical(message)) return message;

  return fallback;
}

export function customerMessageForCode(code: string, fallback = "요청을 다시 확인해주세요.") {
  return CUSTOMER_ERROR_MESSAGES[code.toUpperCase()] ?? fallback;
}
