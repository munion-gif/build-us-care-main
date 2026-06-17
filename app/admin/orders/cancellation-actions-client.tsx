"use client";

import { useState } from "react";
import { formatKRW } from "@/lib/format";

type Props = {
  cancellationId: string;
  refundAmount: number;
  refundRate: number;
  localMode?: boolean;
};

export function CancellationActions({ cancellationId, refundAmount, refundRate, localMode = false }: Props) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState("");

  async function submit(action: "approve" | "reject") {
    if (localMode) {
      setMessage("로컬 확인 모드에서는 취소 처리를 변경할 수 없어요.");
      return;
    }
    setLoading(action);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/cancellations/${cancellationId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: action === "approve" ? "관리자 취소 승인" : "관리자 취소 반려" })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "처리하지 못했습니다.");
      setMessage(action === "approve" ? "승인 처리했습니다." : "반려 처리했습니다.");
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "다시 시도해주세요.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="adm-inline-actions">
      <span className="adm-help" style={{ marginTop: 0 }}>
        환불 {formatKRW(refundAmount)} ({Math.round(refundRate * 100)}%)
      </span>
      <button className="adm-btn adm-btn-primary adm-btn-sm" type="button" disabled={loading !== null || localMode} onClick={() => submit("approve")}>
        {loading === "approve" ? "처리 중" : localMode ? "로컬에서 승인 불가" : "승인+환불"}
      </button>
      <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" disabled={loading !== null || localMode} onClick={() => submit("reject")}>
        {loading === "reject" ? "처리 중" : localMode ? "로컬에서 반려 불가" : "반려"}
      </button>
      {message && <span className="adm-help">{message}</span>}
    </div>
  );
}
