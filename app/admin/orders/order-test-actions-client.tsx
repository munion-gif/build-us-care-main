"use client";

import { useState } from "react";

type Props = {
  orderId: string;
  orderNumber?: string | null;
  isTest?: boolean;
  compact?: boolean;
};

export function OrderTestActions({ orderId, orderNumber, isTest = false, compact }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const nextIsTest = !isTest;
  const label = isTest ? "운영 전환" : "테스트 표시";

  async function updateTestFlag() {
    const targetLabel = nextIsTest ? "테스트 주문" : "운영 주문";
    const note = window.prompt(`${orderNumber ?? "이 주문"}을 ${targetLabel}으로 전환할까요?\n메모가 있으면 입력해주세요.`, nextIsTest ? "관리자 테스트" : "");
    if (note === null) return;

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/test`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_test: nextIsTest, note })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? "테스트 상태를 변경하지 못했습니다.");
      }
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "테스트 상태를 변경하지 못했습니다.");
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "adm-test-actions compact" : "adm-test-actions"}>
      <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={updateTestFlag} disabled={busy}>
        {busy ? "처리 중" : label}
      </button>
      {message ? <p className="adm-form-message adm-form-message-error">{message}</p> : null}
    </div>
  );
}
