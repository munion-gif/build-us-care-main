export type OrderStatus =
  | "inquiry"
  | "quoted"
  | "submitted"
  | "draft"
  | "reservation_pending"
  | "payment_pending"
  | "paid"
  | "scheduled"
  | "reservation_confirmed"
  | "preparing"
  | "in_progress"
  | "in_service"
  | "completed"
  | "done"
  | "issue"
  | "warranty"
  | "cancel_requested"
  | "canceled"
  | "cancelled";

export type JobStatus =
  | "pending"
  | "assigned"
  | "scheduled"
  | "in_progress"
  | "done"
  | "inspected"
  | "warranty"
  | "cancelled"
  | null;

export type OrderStatusInfo = {
  label: string;
  description: string;
};

export type TimelineStepState = "done" | "current" | "future";

export type OrderTimelineStep = {
  key: "payment" | "assignment" | "in_progress" | "completed" | "warranty";
  label: string;
  description?: string;
  state: TimelineStepState;
};

function normalizeOrderStatus(status?: string | null): OrderStatus {
  if (status === "inprogress") return "in_progress";
  if (status === "cancelled") return "canceled";
  if (status === "draft" || status === "submitted") return "inquiry";
  if (status === "reservation_confirmed" || status === "preparing") return "scheduled";
  if (status === "reservation_pending") return "payment_pending";
  if (status === "in_service") return "in_progress";
  if (status === "canceled") return "canceled";
  return (status ?? "inquiry") as OrderStatus;
}

function normalizeJobStatus(status?: string | null): JobStatus {
  if (status === "inprogress") return "in_progress";
  return (status ?? null) as JobStatus;
}

export function getOrderStatusLabel(params: {
  orderStatus?: string | null;
  jobStatus?: string | null;
}): OrderStatusInfo {
  const orderStatus = normalizeOrderStatus(params.orderStatus);
  const jobStatus = normalizeJobStatus(params.jobStatus);

  if (orderStatus === "warranty") {
    return {
      label: "A/S 접수됨",
      description: "A/S 요청이 접수되었습니다. 담당자가 내용을 확인한 뒤 순차적으로 연락드릴 예정입니다."
    };
  }

  if (orderStatus === "issue") {
    return {
      label: "시공 후 문제 확인",
      description: "시공 후 확인이 필요한 내용이 접수되었습니다. 담당자가 정리 후 안내드릴 예정입니다."
    };
  }

  if (orderStatus === "cancel_requested") {
    return {
      label: "취소 요청 처리 중",
      description: "취소 요청이 접수되었습니다. 담당자가 확인 후 처리해드립니다."
    };
  }

  if (orderStatus === "canceled" || orderStatus === "cancelled") {
    return {
      label: "주문 취소됨",
      description: "주문이 취소되었습니다. 환불은 카드사 기준으로 처리됩니다."
    };
  }

  if (orderStatus === "in_progress" || jobStatus === "in_progress") {
    return {
      label: "시공 중",
      description: "기사님이 현장에서 시공을 진행 중입니다."
    };
  }

  if (orderStatus === "done") {
    return {
      label: "시공 완료",
      description: "시공이 정상적으로 완료되었습니다. 1년간 무상 A/S를 제공합니다."
    };
  }

  if (orderStatus === "completed" || jobStatus === "done" || jobStatus === "inspected") {
    return {
      label: "시공 완료, 검수 중",
      description: "시공이 완료되었습니다. 검수 후 최종 완료 처리됩니다."
    };
  }

  if ((orderStatus === "paid" || orderStatus === "scheduled") && jobStatus === "scheduled") {
    return {
      label: "방문 예약 확정",
      description: "방문 예약이 확정되었습니다. 예약하신 날짜에 맞춰 기사님이 방문합니다."
    };
  }

  if (orderStatus === "paid" && jobStatus === "assigned") {
    return {
      label: "기사 배정 완료, 예약 확정 대기",
      description: "담당 기사는 배정되었고 방문 일정 최종 확인이 진행 중입니다."
    };
  }

  if (orderStatus === "quoted") {
    return {
      label: "견적 안내 완료",
      description: "견적이 준비되었습니다. 견적을 확인하고 결제를 진행하면 기사 배정이 시작됩니다."
    };
  }

  if (orderStatus === "payment_pending") {
    return {
      label: "결제 대기 중",
      description: "견적 확인이 완료되었습니다. 결제가 완료되면 기사 배정이 시작됩니다."
    };
  }

  if (orderStatus === "paid" || orderStatus === "scheduled") {
    return {
      label: "결제 완료, 기사 배정 중",
      description: "결제가 완료되었습니다. 영업시간 기준 순차적으로 기사 배정과 방문 일정을 안내드릴 예정입니다."
    };
  }

  if (orderStatus === "inquiry") {
    return {
      label: "문의 접수됨",
      description: "문의가 접수되었습니다. 기본 정보 확인 후 견적 또는 상담으로 안내드릴 예정입니다."
    };
  }

  return {
    label: "주문 상태 확인 중",
    description: "주문 진행 상황을 확인하고 있습니다. 문의가 필요하면 고객센터로 연락해주세요."
  };
}

function currentTimelineIndex(orderStatus: OrderStatus, jobStatus: JobStatus) {
  if (orderStatus === "warranty") return 4;
  if (orderStatus === "done" || orderStatus === "issue") return 3;
  if (orderStatus === "completed" || jobStatus === "done" || jobStatus === "inspected") return 3;
  if (orderStatus === "in_progress" || jobStatus === "in_progress") return 2;
  if (jobStatus === "scheduled" || jobStatus === "assigned" || orderStatus === "scheduled" || orderStatus === "paid") return 1;
  return 0;
}

export function getOrderTimelineSteps(params: {
  orderStatus?: string | null;
  jobStatus?: string | null;
}): OrderTimelineStep[] {
  const orderStatus = normalizeOrderStatus(params.orderStatus);
  const jobStatus = normalizeJobStatus(params.jobStatus);
  const activeIndex = currentTimelineIndex(orderStatus, jobStatus);
  const includeWarranty = orderStatus === "warranty";
  const isCanceled = orderStatus === "canceled" || orderStatus === "cancelled" || orderStatus === "cancel_requested";
  const baseSteps: Array<Omit<OrderTimelineStep, "state">> = [
    { key: "payment", label: orderStatus === "inquiry" ? "문의 접수" : "견적/결제" },
    { key: "assignment", label: "기사 배정/예약 확정" },
    { key: "in_progress", label: "시공 중" },
    { key: "completed", label: orderStatus === "issue" ? "시공 후 문제 확인" : "시공 완료" }
  ];

  if (includeWarranty) {
    baseSteps.push({ key: "warranty", label: "A/S 접수" });
  }

  return baseSteps.map((step, index) => {
    let state: TimelineStepState = "future";
    if (isCanceled) {
      state = index === activeIndex ? "current" : index < activeIndex ? "done" : "future";
    } else if (index < activeIndex) {
      state = "done";
    } else if (index === activeIndex) {
      state = "current";
    }
    return { ...step, state };
  });
}
