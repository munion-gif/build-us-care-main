"use client";

import { getOrderStatusLabel, getOrderTimelineSteps } from "@/lib/order-status-label";

type StatusTimelineProps = {
  status: string;
  jobStatus?: string | null;
  scheduledAt?: string | null;
};

function dDayLabel(scheduledAt?: string | null) {
  if (!scheduledAt) return "방문일 확정 전";
  const today = new Date();
  const target = new Date(scheduledAt);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000);
  if (diff === 1) return "방문 예정 D-1";
  if (diff === 0) return "오늘 방문 예정";
  if (diff > 1) return `방문 예정 D-${diff}`;
  return "방문 예정일 경과";
}

export function StatusTimeline({ status, jobStatus, scheduledAt }: StatusTimelineProps) {
  const steps = getOrderTimelineSteps({ orderStatus: status, jobStatus });
  const statusInfo = getOrderStatusLabel({ orderStatus: status, jobStatus });

  return (
    <section className="order-card">
      <h2>진행 상태</h2>
      <div className="timeline-current-summary">
        <strong>{statusInfo.label}</strong>
        <p>{statusInfo.description}</p>
        {(jobStatus === "scheduled" || status === "scheduled") && <small>{dDayLabel(scheduledAt)}</small>}
      </div>
      <ol className="status-timeline">
        {steps.map((step, index) => {
          const done = step.state === "done";
          const current = step.state === "current";
          return (
            <li key={step.key} className={done ? "done" : current ? "current" : "future"}>
              <span>{done ? "✓" : index + 1}</span>
              <p>{step.label}</p>
            </li>
          );
        })}
      </ol>
      {status === "issue" && <p className="inline-warning">시공 이슈가 확인됐어요. 담당자가 연락드릴게요.</p>}
      {status === "warranty" && <p className="inline-warning">A/S가 접수됐어요. 영업일 1일 내 연락드릴게요.</p>}
      {status === "cancel_requested" && <p className="inline-warning">취소 요청이 접수됐어요. 담당자가 확인 후 처리해드릴게요.</p>}
      {(status === "canceled" || status === "cancelled") && <p className="inline-warning">주문이 취소됐어요. 환불은 카드사 기준으로 처리됩니다.</p>}
    </section>
  );
}
