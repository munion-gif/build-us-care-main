"use client";

import { useState } from "react";

type Props = {
  orderId: string;
  orderNumber: string;
  amount: number;
  compact?: boolean;
};

function won(value: number) {
  return `${Number(value ?? 0).toLocaleString("ko-KR")}원`;
}

export function OrderBankTransferConfirmButton({ orderId, orderNumber, amount, compact = false }: Props) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function confirmPayment() {
    if (!window.confirm(`${orderNumber} 입금 ${won(amount)}을 확인 완료 처리할까요?`)) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json?.error?.message ?? "입금 확인 처리에 실패했습니다.");
      setMessage("입금 확인 처리했습니다.");
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "입금 확인 처리에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={compact ? "adm-inline-actions adm-bank-confirm-compact" : "adm-inline-actions"}>
      <button className={compact ? "adm-btn adm-btn-primary adm-btn-sm" : "adm-btn adm-btn-primary"} type="button" onClick={confirmPayment} disabled={saving}>
        {saving ? "처리 중" : "입금 확인"}
      </button>
      {message ? <p className={message.includes("실패") ? "adm-form-message adm-form-message-error" : "adm-form-message"}>{message}</p> : null}
    </div>
  );
}
