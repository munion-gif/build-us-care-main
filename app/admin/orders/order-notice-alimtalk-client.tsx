"use client";

import { useMemo, useState } from "react";

type Props = {
  orderId: string;
  orderNumber: string;
  customerName?: string | null;
  paymentAmount?: number | null;
  visitText?: string | null;
  localMode?: boolean;
};

function won(value?: number | null) {
  return `${Math.max(0, Number(value ?? 0)).toLocaleString("ko-KR")}원`;
}

export function OrderNoticeAlimtalkPanel({ orderId, orderNumber, customerName, paymentAmount, visitText, localMode = false }: Props) {
  const name = customerName?.trim() || "고객";
  const [memo, setMemo] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const presets = useMemo(() => ({
    payment: `안녕하세요! 빌드어스입니다.\n\n${name}님 주문이 정상 접수되었습니다.\n제품 금액 ${won(paymentAmount)} 입금 확인 후 기사 배정과 방문 일정 안내가 진행됩니다.\n\n감사합니다.`,
    schedule: `안녕하세요! 빌드어스입니다.\n\n${name}님 주문의 방문 일정은 ${visitText || "확인 중"}입니다.\n방문 전 담당 기사 배정 후 다시 안내드리겠습니다.\n\n감사합니다.`,
    confirm: `안녕하세요! 빌드어스입니다.\n\n${name}님 주문 진행을 위해 추가 확인이 필요합니다.\n카카오톡 답장으로 확인 가능한 내용을 남겨주시면 이어서 안내드리겠습니다.\n\n감사합니다.`,
    status: `안녕하세요! 빌드어스입니다.\n\n${name}님 주문 현황 안내드립니다.\n접수번호는 ${orderNumber}이며, 아래 버튼에서 주문 진행 상태를 확인하실 수 있습니다.\n\n감사합니다.`
  }), [name, orderNumber, paymentAmount, visitText]);

  async function send() {
    if (localMode) {
      setMessage("로컬 확인 모드에서는 카카오 알림톡을 발송할 수 없어요.");
      return;
    }
    if (!memo.trim()) {
      setMessage("안내 메모를 입력한 뒤 발송해주세요.");
      return;
    }

    setSending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/notice-alimtalk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? "주문 안내 알림톡 발송에 실패했습니다.");
      }
      setMessage("주문 안내 알림톡을 발송했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "주문 안내 알림톡 발송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="adm-card adm-order-notice-panel">
      <div className="adm-section-head">
        <div>
          <h2 className="adm-card-title">고객 안내</h2>
          <p className="adm-muted">입금, 방문 일정, 추가 확인처럼 고객에게 보낼 주문 안내문을 작성합니다.</p>
        </div>
        <button className="adm-btn adm-btn-primary adm-btn-sm" type="button" onClick={send} disabled={sending || localMode}>
          {sending ? "발송 중" : localMode ? "로컬에서 발송 불가" : "알림톡 발송"}
        </button>
      </div>
      <textarea
        className="adm-input"
        value={memo}
        onChange={(event) => setMemo(event.target.value)}
        placeholder="고객에게 보낼 안내 메모를 입력하세요."
        rows={6}
      />
      <div className="adm-action-row-buttons">
        <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={() => setMemo(presets.payment)}>입금안내 문구 넣기</button>
        <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={() => setMemo(presets.schedule)}>방문일정 문구 넣기</button>
        <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={() => setMemo(presets.confirm)}>추가확인 문구 넣기</button>
        <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={() => setMemo(presets.status)}>주문현황 문구 넣기</button>
      </div>
      <p className="adm-help">발송 버튼은 Solapi 주문 안내 템플릿 승인 후 동작합니다. 버튼 링크는 고객 주문 현황 화면으로 연결됩니다.</p>
      {message ? <p className={message.includes("발송했습니다") ? "adm-form-message" : "adm-form-message adm-form-message-error"}>{message}</p> : null}
    </section>
  );
}
