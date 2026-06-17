"use client";

import { useState } from "react";

type Props = {
  diagnosisId: string;
  receiptNumber?: string | null;
  isTest?: boolean;
  localMode?: boolean;
};

export function DiagnosisTestActions({ diagnosisId, receiptNumber, isTest = false, localMode = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const nextIsTest = !isTest;
  const label = isTest ? "운영 접수 전환" : "테스트 접수 표시";

  async function updateTestFlag() {
    if (localMode) {
      setMessage("로컬 확인 모드에서는 테스트 상태를 변경할 수 없어요.");
      return;
    }
    const targetLabel = nextIsTest ? "테스트 접수" : "운영 접수";
    const note = window.prompt(`${receiptNumber ?? "이 사진확인 접수"}를 ${targetLabel}로 전환할까요?\n메모가 있으면 입력해주세요.`, nextIsTest ? "관리자 테스트" : "");
    if (note === null) return;

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/diagnoses/${diagnosisId}/test`, {
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
    <div className="adm-test-actions">
      <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={updateTestFlag} disabled={busy || localMode}>
        {busy ? "처리 중" : localMode ? "로컬에서 변경 불가" : label}
      </button>
      {message ? <p className="adm-form-message adm-form-message-error">{message}</p> : null}
    </div>
  );
}
