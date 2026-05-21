"use client";

import { useState } from "react";
import { getAllowedOrderTransitions, getOrderStatusUx, BLOCKED_TRANSITION_HINTS } from "@/lib/order-status-ux";
import type { OperationalOrderStatus, OrderStatus } from "@/lib/types";

type Props = {
  orderId: string;
  currentStatus: OrderStatus;
};

const IMPORTANT_BLOCKED_TARGETS: OperationalOrderStatus[] = ["quoted", "payment_pending", "paid", "scheduled", "in_progress", "completed", "done", "warranty", "canceled"];

export function OrderStatusTransitionPanel({ orderId, currentStatus }: Props) {
  const [savingStatus, setSavingStatus] = useState<OperationalOrderStatus | null>(null);
  const [message, setMessage] = useState("");
  const allowed = getAllowedOrderTransitions(currentStatus);
  const ux = getOrderStatusUx(currentStatus);

  async function transitionTo(nextStatus: OperationalOrderStatus) {
    if (!window.confirm(`${ux.adminLabel} 상태를 ${getOrderStatusUx(nextStatus).adminLabel}(으)로 변경할까요?`)) return;
    setSavingStatus(nextStatus);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "상태 변경에 실패했습니다.");
      setMessage(`${getOrderStatusUx(nextStatus).adminLabel} 상태로 변경했습니다.`);
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "상태 변경에 실패했습니다.");
    } finally {
      setSavingStatus(null);
    }
  }

  const blockedHints = IMPORTANT_BLOCKED_TARGETS
    .filter((target) => target !== currentStatus && !allowed.includes(target))
    .map((target) => ({
      target,
      hint: BLOCKED_TRANSITION_HINTS[currentStatus]?.[target] ?? `${ux.adminLabel} 상태에서는 ${getOrderStatusUx(target).adminLabel}(으)로 바로 변경할 수 없습니다.`
    }))
    .filter((item) => BLOCKED_TRANSITION_HINTS[currentStatus]?.[item.target]);
  const primaryBlockedHint = blockedHints[0];

  return (
    <section className="adm-card adm-status-panel">
      <div className="adm-section-head">
        <div>
          <h2 className="adm-card-title">상태 변경</h2>
          <strong className="adm-status-current">{ux.adminLabel}</strong>
          <p className="adm-status-summary">{ux.adminSummary}</p>
        </div>
        <span className="adm-badge adm-badge-sky">{currentStatus}</span>
      </div>

      {allowed.length > 0 ? (
        <div className="adm-transition-grid" aria-label="가능한 다음 상태">
          {allowed.map((status) => (
            <button
              key={status}
              type="button"
              className={status === "canceled" ? "adm-transition-button danger" : "adm-transition-button"}
              disabled={Boolean(savingStatus)}
              onClick={() => transitionTo(status)}
            >
              <span>{getOrderStatusUx(status).adminLabel}</span>
              <small>{getOrderStatusUx(status).adminSummary}</small>
              {savingStatus === status && <em>변경 중</em>}
            </button>
          ))}
        </div>
      ) : (
        <div className="adm-empty adm-empty-line">
          <div className="adm-empty-title">이 상태에서 가능한 다음 전이가 없습니다.</div>
          <div className="adm-empty-sub">메모나 예외 처리만 진행하세요.</div>
        </div>
      )}

      {primaryBlockedHint && (
        <div className="adm-blocked-note" aria-label="상태 전이 차단 안내">
          <span>{getOrderStatusUx(primaryBlockedHint.target).adminLabel} 차단</span>
          <p>{primaryBlockedHint.hint}</p>
        </div>
      )}

      {message && <p className="adm-form-message">{message}</p>}
    </section>
  );
}
