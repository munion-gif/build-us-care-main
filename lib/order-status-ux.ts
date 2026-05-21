import { ORDER_TRANSITIONS } from "@/lib/status";
import type { OperationalOrderStatus, OrderStatus } from "@/lib/types";

export type OrderStatusUx = {
  customerLabel: string;
  adminLabel: string;
  customerSummary: string;
  adminSummary: string;
  warrantyHint: string;
};

export const ORDER_STATUS_UX: Record<OrderStatus, OrderStatusUx> = {
  inquiry: {
    customerLabel: "문의 접수",
    adminLabel: "문의 검토",
    customerSummary: "문의가 접수되었습니다. 확인 후 견적을 안내드릴게요.",
    adminSummary: "문의 내용을 확인하고 견적으로 전환해야 합니다.",
    warrantyHint: "A/S는 최종 완료 후 가능합니다."
  },
  quoted: {
    customerLabel: "견적 안내",
    adminLabel: "견적 완료",
    customerSummary: "견적이 준비되었습니다. 금액과 작업 범위를 확인해 주세요.",
    adminSummary: "견적 확인 후 결제 대기 상태로 전환할 수 있습니다.",
    warrantyHint: "아직 A/S 대상 단계가 아닙니다."
  },
  payment_pending: {
    customerLabel: "결제 대기",
    adminLabel: "결제 대기",
    customerSummary: "결제가 완료되면 기사 배정과 일정 안내가 시작됩니다.",
    adminSummary: "결제 진행 여부를 확인해야 합니다.",
    warrantyHint: "아직 A/S 대상 단계가 아닙니다."
  },
  paid: {
    customerLabel: "결제 완료",
    adminLabel: "결제 완료",
    customerSummary: "결제가 완료되었습니다. 방문 일정을 조율하고 있어요.",
    adminSummary: "방문 일정과 기사 배정이 필요합니다.",
    warrantyHint: "A/S는 최종 완료 후 가능합니다."
  },
  scheduled: {
    customerLabel: "방문 확정",
    adminLabel: "방문 확정",
    customerSummary: "방문 일정이 확정되었습니다. 예약한 시간에 맞춰 방문합니다.",
    adminSummary: "방문 전 준비 상태입니다. 바로 최종 완료 처리할 수 없습니다.",
    warrantyHint: "A/S는 작업과 최종 완료 후 가능합니다."
  },
  in_progress: {
    customerLabel: "작업 진행 중",
    adminLabel: "작업 진행",
    customerSummary: "기사님이 현장에서 작업을 진행 중입니다.",
    adminSummary: "작업 결과에 따라 작업 완료 또는 이슈를 기록합니다.",
    warrantyHint: "작업 중에는 A/S 접수가 아니라 이슈로 관리합니다."
  },
  completed: {
    customerLabel: "작업 완료 확인 중",
    adminLabel: "작업 완료, 검수 전",
    customerSummary: "작업은 끝났지만 아직 최종 확인 및 정산이 진행 중입니다. 최종 완료 후 A/S 접수가 가능합니다.",
    adminSummary: "최종 완료(done) 처리 전 단계입니다. warranty로 바로 전환할 수 없습니다.",
    warrantyHint: "현재는 A/S 접수 전 단계입니다. 최종 완료 후 A/S 가능 상태로 바뀌면 접수할 수 있습니다."
  },
  done: {
    customerLabel: "최종 완료, A/S 접수 가능",
    adminLabel: "최종 완료",
    customerSummary: "최종 완료되었습니다. 보증 조건에 해당하는 문제가 있으면 이 주문 링크에서 A/S를 요청할 수 있어요.",
    adminSummary: "A/S 접수 가능 상태입니다.",
    warrantyHint: "A/S 접수가 가능합니다."
  },
  issue: {
    customerLabel: "문제 확인 중",
    adminLabel: "이슈 처리",
    customerSummary: "확인이 필요한 내용이 접수되었습니다. 담당자가 해결 방향을 안내드릴 예정입니다.",
    adminSummary: "작업 중/작업 후 이슈를 해결하고 적절한 진행 상태로 되돌립니다.",
    warrantyHint: "이 상태에서는 담당자 확인 후 안내됩니다."
  },
  warranty: {
    customerLabel: "A/S 접수",
    adminLabel: "A/S 처리",
    customerSummary: "A/S 요청이 접수되었습니다. 담당자가 내용을 확인 중입니다.",
    adminSummary: "A/S 케이스의 책임 구분, 일정, 해결 여부를 관리합니다.",
    warrantyHint: "이미 A/S가 접수된 상태입니다."
  },
  cancel_requested: {
    customerLabel: "취소 요청",
    adminLabel: "취소 요청",
    customerSummary: "취소 요청이 접수되었습니다. 환불 가능 여부를 확인 중입니다.",
    adminSummary: "취소/환불 정책에 따라 처리해야 합니다.",
    warrantyHint: "취소 요청 상태에서는 A/S를 접수할 수 없습니다."
  },
  canceled: {
    customerLabel: "취소됨",
    adminLabel: "취소됨",
    customerSummary: "주문이 취소되었습니다. 필요하면 새로 문의해 주세요.",
    adminSummary: "취소 완료 상태입니다. 결제 완료 상태로 되돌릴 수 없습니다.",
    warrantyHint: "취소된 주문은 A/S 대상이 아닙니다."
  },
  submitted: {
    customerLabel: "문의 접수",
    adminLabel: "Legacy 문의",
    customerSummary: "문의가 접수되었습니다. 확인 후 견적을 안내드릴게요.",
    adminSummary: "legacy 문의 상태입니다. 견적 또는 취소로 정리합니다.",
    warrantyHint: "A/S는 최종 완료 후 가능합니다."
  },
  draft: {
    customerLabel: "작성 중",
    adminLabel: "Legacy 초안",
    customerSummary: "문의 정보를 확인하고 있습니다.",
    adminSummary: "legacy 초안 상태입니다. 문의 접수 또는 취소로 정리합니다.",
    warrantyHint: "A/S는 최종 완료 후 가능합니다."
  },
  reservation_pending: {
    customerLabel: "결제 대기",
    adminLabel: "Legacy 예약 대기",
    customerSummary: "결제 또는 예약 확인이 필요합니다.",
    adminSummary: "legacy 예약 대기 상태입니다. 결제/예약 상태를 확인합니다.",
    warrantyHint: "A/S는 최종 완료 후 가능합니다."
  },
  reservation_confirmed: {
    customerLabel: "방문 확정",
    adminLabel: "Legacy 예약 확정",
    customerSummary: "방문 일정이 확정되었습니다.",
    adminSummary: "legacy 예약 확정 상태입니다. 작업 시작 단계로 정리합니다.",
    warrantyHint: "A/S는 최종 완료 후 가능합니다."
  },
  preparing: {
    customerLabel: "방문 준비",
    adminLabel: "Legacy 준비 중",
    customerSummary: "방문 전 준비가 진행 중입니다.",
    adminSummary: "legacy 준비 상태입니다. 방문 확정 또는 작업 진행으로 정리합니다.",
    warrantyHint: "A/S는 최종 완료 후 가능합니다."
  },
  in_service: {
    customerLabel: "작업 진행 중",
    adminLabel: "Legacy 작업 중",
    customerSummary: "기사님이 현장에서 작업을 진행 중입니다.",
    adminSummary: "legacy 작업 중 상태입니다. 진행/완료/이슈로 정리합니다.",
    warrantyHint: "작업 중에는 A/S 접수가 아니라 이슈로 관리합니다."
  },
  cancelled: {
    customerLabel: "취소됨",
    adminLabel: "Legacy 취소",
    customerSummary: "주문이 취소되었습니다. 필요하면 새로 문의해 주세요.",
    adminSummary: "legacy 취소 상태입니다. 결제 완료 상태로 되돌릴 수 없습니다.",
    warrantyHint: "취소된 주문은 A/S 대상이 아닙니다."
  }
};

export const BLOCKED_TRANSITION_HINTS: Partial<Record<OrderStatus, Partial<Record<OperationalOrderStatus, string>>>> = {
  inquiry: {
    payment_pending: "문의 접수 상태에서는 결제 대기로 바로 넘길 수 없습니다. 먼저 견적 완료로 전환하세요."
  },
  completed: {
    warranty: "작업 완료 확인 중에는 A/S로 바로 전환할 수 없습니다. 최종 완료(done) 후 접수하세요."
  },
  scheduled: {
    done: "방문 확정 상태에서는 바로 최종 완료할 수 없습니다. 작업 진행/완료 단계를 먼저 처리하세요."
  },
  canceled: {
    paid: "취소된 주문은 결제 완료 상태로 되돌릴 수 없습니다. 새 문의로 처리하세요."
  },
  cancelled: {
    paid: "취소된 주문은 결제 완료 상태로 되돌릴 수 없습니다. 새 문의로 처리하세요."
  }
};

export function getAllowedOrderTransitions(status: OrderStatus): OperationalOrderStatus[] {
  return ORDER_TRANSITIONS[status] ?? [];
}

export function getOrderStatusUx(status?: string | null): OrderStatusUx {
  const key = (status === "cancelled" ? "cancelled" : status ?? "inquiry") as OrderStatus;
  return ORDER_STATUS_UX[key] ?? ORDER_STATUS_UX.inquiry;
}
