"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  diagnosisId: string;
  receiptNumber?: string | null;
  hasLinkedOrder?: boolean;
  localMode?: boolean;
};

async function readError(response: Response) {
  try {
    const json = await response.json();
    return json?.error?.message || json?.message || "요청을 처리하지 못했습니다.";
  } catch {
    return "요청을 처리하지 못했습니다.";
  }
}

export function DiagnosisDeleteActions({ diagnosisId, receiptNumber, hasLinkedOrder = false, localMode = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const label = receiptNumber ? `사진확인 ${receiptNumber}` : "이 사진확인 접수";

  async function remove() {
    if (localMode) {
      setMessage("로컬 확인 모드에서는 삭제할 수 없어요.");
      return;
    }
    if (hasLinkedOrder) {
      setMessage("주문에 연결된 사진확인 접수는 주문관리에서 먼저 정리해 주세요.");
      return;
    }
    if (!window.confirm(`${label}을(를) 삭제할까요?\n삭제 후에는 복구할 수 없습니다.`)) return;
    setLoading(true);
    setMessage("");
    const response = await fetch(`/api/admin/diagnoses/${diagnosisId}`, { method: "DELETE" });
    setLoading(false);
    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }
    router.push("/admin/diagnoses");
    router.refresh();
  }

  return (
    <div className="adm-trash-actions compact">
      <button className="adm-btn adm-btn-danger adm-btn-sm" type="button" disabled={loading || localMode} onClick={remove}>
        {loading ? "삭제 중..." : localMode ? "로컬에서 삭제 불가" : "삭제"}
      </button>
      {message ? <small className="adm-trash-message">{message}</small> : null}
    </div>
  );
}
