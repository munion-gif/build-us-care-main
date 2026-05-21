"use client";

import { CalendarDays, CreditCard, ShieldCheck } from "lucide-react";
import { formatKRDate, formatKRW } from "@/lib/format";
import { getOrderStatusLabel } from "@/lib/order-status-label";

type OrderCurrentStatusPanelProps = {
  order: any;
  job?: any | null;
  reservation?: any | null;
  payment?: any | null;
  quote?: any | null;
  serviceName: string;
};

export function OrderCurrentStatusPanel({ order, job, reservation, payment, quote, serviceName }: OrderCurrentStatusPanelProps) {
  const status = getOrderStatusLabel({ orderStatus: order?.status, jobStatus: job?.status ?? null });
  const amount = Number(payment?.amount ?? quote?.total_final ?? order?.total_amount ?? 0);
  const visit = reservation?.reserved_date ?? job?.scheduled_at ?? null;

  return (
    <section className="order-current-panel" aria-label="현재 주문 상태">
      <div className="order-current-main">
        <span>현재 상태</span>
        <h2>{status.label}</h2>
        <p>{nextStatusCopy(order?.status, job?.status) ?? status.description}</p>
      </div>
      <dl>
        <div>
          <dt><CreditCard size={16} /> 결제</dt>
          <dd>{amount > 0 ? formatKRW(amount) : "확인 중"}</dd>
        </div>
        <div>
          <dt><CalendarDays size={16} /> 방문</dt>
          <dd>{visit ? formatKRDate(visit) : "일정 확정 전"}</dd>
        </div>
        <div>
          <dt><ShieldCheck size={16} /> 작업</dt>
          <dd>{serviceName}</dd>
        </div>
      </dl>
    </section>
  );
}

function nextStatusCopy(orderStatus?: string | null, jobStatus?: string | null) {
  const normalizedOrderStatus = normalizeOrderStatusForUi(orderStatus);
  if (normalizedOrderStatus === "quoted") return "견적이 준비됐어요. 결제를 진행하면 기사 배정이 시작됩니다.";
  if (normalizedOrderStatus === "payment_pending") return "결제 대기 중이에요. 결제가 완료되면 방문 일정을 안내드릴게요.";
  if (normalizedOrderStatus === "paid" && jobStatus === "assigned") return "담당 기사가 배정됐어요. 방문 일정 최종 확인 후 확정 안내드릴게요.";
  if (normalizedOrderStatus === "paid") return "결제가 완료됐어요. 기사 배정 후 방문 일정을 안내드릴게요.";
  if (normalizedOrderStatus === "scheduled" || jobStatus === "scheduled") return "방문 일정이 확정됐어요. 변경이 필요하면 아래에서 요청하세요.";
  if (normalizedOrderStatus === "in_progress" || jobStatus === "in_progress") return "작업이 진행 중이에요. 완료 후 사진과 상태가 업데이트됩니다.";
  if (normalizedOrderStatus === "completed" || jobStatus === "done" || jobStatus === "completed") return "작업은 끝났지만 아직 최종 확인 및 정산이 진행 중입니다.";
  if (normalizedOrderStatus === "done") return "최종 완료 상태입니다. 보증 조건에 해당하면 A/S를 접수할 수 있어요.";
  if (normalizedOrderStatus === "warranty") return "A/S가 접수됐어요. 담당자가 확인 후 연락드립니다.";
  return null;
}

function normalizeOrderStatusForUi(status?: string | null) {
  if (status === "cancelled") return "canceled";
  if (status === "submitted" || status === "draft") return "inquiry";
  if (status === "reservation_confirmed" || status === "preparing") return "scheduled";
  if (status === "reservation_pending") return "payment_pending";
  if (status === "in_service") return "in_progress";
  return status ?? "";
}
