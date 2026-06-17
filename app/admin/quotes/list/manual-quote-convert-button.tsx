"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  quoteId: string;
};

type DeleteProps = Props & {
  quoteNumber?: string | null;
};

export function ManualQuoteConvertButton({ quoteId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function convertToOrder() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/manual-quotes/${encodeURIComponent(quoteId)}/convert-order`, {
        method: "POST"
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "제품 주문 전환에 실패했습니다.");
      }

      const orderId = payload?.data?.order?.id ?? payload?.data?.orderId;
      setMessage(payload?.data?.alreadyConverted ? "이미 제품 주문으로 전환된 견적입니다." : "제품 주문으로 전환했습니다.");
      router.refresh();
      if (orderId) {
        window.setTimeout(() => {
          router.push(`/admin/orders/${orderId}`);
        }, 500);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "제품 주문 전환에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="adm-inline-action-stack">
      <button className="adm-btn adm-btn-secondary" type="button" onClick={convertToOrder} disabled={loading}>
        {loading ? "전환 중..." : "제품 주문으로 전환"}
      </button>
      {message ? <small className="adm-action-message">{message}</small> : null}
    </span>
  );
}

export function ManualQuoteDeleteButton({ quoteId, quoteNumber }: DeleteProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function deleteQuote() {
    const label = quoteNumber ? `견적서 ${quoteNumber}` : "이 견적서";
    if (!window.confirm(`${label}를 목록에서 삭제할까요?\n제품 주문으로 전환된 주문은 삭제되지 않습니다.`)) return;

    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/manual-quotes/${encodeURIComponent(quoteId)}`, {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "견적서 삭제에 실패했습니다.");
      }

      setMessage("견적서를 삭제했습니다.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "견적서 삭제에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="adm-inline-action-stack">
      <button className="adm-btn adm-btn-danger" type="button" onClick={deleteQuote} disabled={loading}>
        {loading ? "삭제 중..." : "삭제"}
      </button>
      {message ? <small className="adm-action-message">{message}</small> : null}
    </span>
  );
}
