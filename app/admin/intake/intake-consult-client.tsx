"use client";

import { useEffect, useRef, useState } from "react";

export type ConsultMessage = { who: "me" | "cust"; text: string };

type Props = {
  intakeId: string;
  customerName?: string | null;
  initialMessages?: ConsultMessage[];
  /** 로컬/미리보기에서는 실제 발송 대신 화면에만 추가 */
  localMode?: boolean;
};

/**
 * 카카오 상담 패널 — 관리자가 먼저 메시지를 보내면 솔라피 알림톡으로 고객 카톡에 발송.
 * 실제 발송은 승인된 상담 템플릿(SOLAPI_CONSULT_TEMPLATE_ID)이 등록되면 연결됩니다.
 */
export function IntakeConsult({ intakeId, customerName, initialMessages = [], localMode = false }: Props) {
  const [messages, setMessages] = useState<ConsultMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeId]);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setMessages((prev) => [...prev, { who: "me", text }]);
    setDraft("");
    setNote(null);

    if (localMode) {
      setNote("미리보기 모드 — 실제 발송은 프로덕션 + 상담 템플릿 승인 후 연결됩니다.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/admin/intake/${encodeURIComponent(intakeId)}/consult-alimtalk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setNote(body?.error?.message ?? "발송에 실패했어요. 상담 템플릿(SOLAPI_CONSULT_TEMPLATE_ID) 설정을 확인해주세요.");
      } else {
        setNote("고객 카톡으로 발송했어요.");
      }
    } catch {
      setNote("발송 중 오류가 생겼어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="it-panel it-consult">
      <div className="it-panel-h">
        <h3>카카오 상담</h3>
        <span className="it-meta">솔라피 알림톡 · 카카오 채널</span>
      </div>
      <div className="it-chat" ref={boxRef}>
        {messages.length === 0 ? (
          <div className="it-chat-empty">
            {customerName ? `${customerName} 님` : "고객"}에게 먼저 메시지를 보내 상담을 시작하세요.
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`it-bubble ${m.who === "me" ? "me" : "cust"}`}>
              {m.text}
            </div>
          ))
        )}
      </div>
      <div className="it-composer">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="고객에게 보낼 메시지를 입력…"
          disabled={sending}
        />
        <button type="button" onClick={send} disabled={sending || !draft.trim()}>
          {sending ? "발송 중…" : "보내기"}
        </button>
      </div>
      <div className="it-consult-foot">
        🔗 내가 먼저 메시지를 보내면 <b>고객 카톡으로 발송</b>돼요 (솔라피 알림톡).
        {note ? <span className="it-consult-note"> {note}</span> : null}
      </div>
    </div>
  );
}
