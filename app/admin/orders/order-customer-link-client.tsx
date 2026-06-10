"use client";

import { useMemo, useState } from "react";

type Props = {
  orderNumber: string;
  lookupUrl: string;
  customerName?: string | null;
};

export function OrderCustomerLinkCopy({ orderNumber, lookupUrl, customerName }: Props) {
  const [message, setMessage] = useState("");
  const guideText = useMemo(() => {
    const nameLine = customerName ? `${customerName} 고객님, ` : "";
    return [
      `${nameLine}Build us Care 접수 안내입니다.`,
      `접수번호: ${orderNumber}`,
      `주문 현황 확인: ${lookupUrl}`,
      "카카오톡으로 문의주시면 이어서 도와드릴게요."
    ].join("\n");
  }, [customerName, lookupUrl, orderNumber]);

  async function copy(text: string, doneMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(doneMessage);
    } catch {
      setMessage("복사에 실패했습니다. 링크를 직접 선택해서 복사해주세요.");
    }
  }

  return (
    <section className="adm-card adm-customer-link-panel">
      <div>
        <h2 className="adm-card-title">고객 안내 링크</h2>
        <p className="adm-muted">카카오톡으로 보낼 주문조회 안내문입니다. 고객은 링크에서 접수번호가 자동 입력되고 성함만 입력하면 됩니다.</p>
      </div>
      <div className="adm-copy-box">
        <code>{lookupUrl}</code>
      </div>
      <div className="adm-quick-actions">
        <button className="adm-btn adm-btn-primary adm-btn-sm" type="button" onClick={() => copy(guideText, "카카오톡 안내문을 복사했습니다.")}>
          카톡 안내문 복사
        </button>
        <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={() => copy(lookupUrl, "조회 링크를 복사했습니다.")}>
          링크만 복사
        </button>
      </div>
      {message ? <p className="adm-form-message">{message}</p> : null}
    </section>
  );
}
