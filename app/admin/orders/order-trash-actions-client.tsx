"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  orderId: string;
  orderNumber?: string | null;
  mode?: "active" | "trash";
  compact?: boolean;
};

async function readError(response: Response) {
  try {
    const json = await response.json();
    return json?.error?.message || json?.message || "요청을 처리하지 못했습니다.";
  } catch {
    return "요청을 처리하지 못했습니다.";
  }
}

export function OrderTrashActions({ orderId, orderNumber, mode = "active", compact }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"trash" | "restore" | "delete" | null>(null);
  const [message, setMessage] = useState("");
  const label = orderNumber ? `주문 ${orderNumber}` : "이 주문";

  async function moveToTrash() {
    const reason = window.prompt(`${label}을(를) 휴지통으로 이동할까요?\n필요하면 삭제 메모를 입력해주세요.`, "테스트/중복 주문 정리");
    if (reason === null) return;
    setLoading("trash");
    setMessage("");
    const response = await fetch(`/api/admin/orders/${orderId}/trash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
    setLoading(null);
    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }
    router.refresh();
  }

  async function restore() {
    if (!window.confirm(`${label}을(를) 주문관리로 복구할까요?`)) return;
    setLoading("restore");
    setMessage("");
    const response = await fetch(`/api/admin/orders/${orderId}/trash`, { method: "PATCH" });
    setLoading(null);
    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }
    router.refresh();
  }

  async function permanentDelete() {
    if (!window.confirm(`${label}을(를) 완전 삭제할까요?\n삭제 후에는 복구할 수 없습니다.`)) return;
    setLoading("delete");
    setMessage("");
    const response = await fetch(`/api/admin/orders/${orderId}/trash`, { method: "DELETE" });
    setLoading(null);
    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }
    router.refresh();
  }

  if (mode === "trash") {
    return (
      <div className={compact ? "adm-trash-actions compact" : "adm-trash-actions"}>
        <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" disabled={loading !== null} onClick={restore}>
          {loading === "restore" ? "복구 중..." : "복구"}
        </button>
        <button className="adm-btn adm-btn-danger adm-btn-sm" type="button" disabled={loading !== null} onClick={permanentDelete}>
          {loading === "delete" ? "삭제 중..." : "완전 삭제"}
        </button>
        {message ? <small className="adm-trash-message">{message}</small> : null}
      </div>
    );
  }

  return (
    <div className={compact ? "adm-trash-actions compact" : "adm-trash-actions"}>
      <button className="adm-btn adm-btn-danger adm-btn-sm" type="button" disabled={loading !== null} onClick={moveToTrash}>
        {loading === "trash" ? "이동 중..." : "휴지통"}
      </button>
      {message ? <small className="adm-trash-message">{message}</small> : null}
    </div>
  );
}
