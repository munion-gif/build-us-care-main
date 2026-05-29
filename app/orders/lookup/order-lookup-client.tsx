"use client";

import { useEffect, useState } from "react";
import { OrderLookupResultCard } from "@/components/orders/OrderLookupResultCard";
import { EVENT_TYPES } from "@/lib/event-types";
import { getKakaoChannelChatUrl } from "@/lib/kakao-channel";
import { appendSourceParams, readClientSourceContext, type SourceContext } from "@/lib/traffic-source";
import { useTracking } from "@/lib/use-tracking";

type LookupOrder = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  serviceName: string;
  paymentStatus: string | null;
  isPaid: boolean;
  reservation: { reservedDate: string; timeSlot: string; status: string } | null;
  jobStatus: string | null;
  link: string;
};

function OrderLookupForm({
  name,
  phone,
  loading,
  onNameChange,
  onPhoneChange
}: {
  name: string;
  phone: string;
  loading: boolean;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
}) {
  return (
    <div className="lookup-form-grid">
      <label>
        이름
        <input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="홍길동" autoComplete="name" required />
      </label>
      <label>
        전화번호
        <input value={phone} onChange={(event) => onPhoneChange(event.target.value)} placeholder="010-0000-0000" inputMode="tel" autoComplete="tel" required />
      </label>
      <button type="submit" disabled={loading}>{loading ? "조회 중..." : "주문내역 조회"}</button>
    </div>
  );
}

function OrderLookupResults({ orders }: { orders: LookupOrder[] }) {
  if (orders.length === 0) return null;

  return (
    <section className="lookup-results" aria-label="조회된 주문 목록">
      <div className="lookup-results-head">
        <h2>조회된 주문</h2>
        <span>최신순 {orders.length}건</span>
      </div>
      <div className="lookup-order-list">
        {orders.map((order) => <OrderLookupResultCard key={order.id} order={order} />)}
      </div>
    </section>
  );
}

type OrderLookupClientProps = {
  kakaoUrl: string | null;
};

export function OrderLookupClient({ kakaoUrl }: OrderLookupClientProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [orders, setOrders] = useState<LookupOrder[]>([]);
  const [sourceContext, setSourceContext] = useState<SourceContext>(() => readClientSourceContext());
  const { track } = useTracking();
  const isInstagram = sourceContext.isInstagram;
  const photoHref = appendSourceParams("/request/photo", sourceContext);
  const servicesHref = appendSourceParams("/services", sourceContext);
  const kakaoChatUrl = getKakaoChannelChatUrl(kakaoUrl);

  useEffect(() => {
    setSourceContext(readClientSourceContext());
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setOrders([]);
    try {
      if (isInstagram) {
        void track(EVENT_TYPES.ORDER_LOOKUP_FROM_INSTAGRAM, { entry: "lookup_page" });
      }
      const response = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "이름과 전화번호를 다시 확인해주세요.");
      setMessage(json.data?.message ?? "조회 결과를 확인해주세요.");
      setOrders(json.data?.orders ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "주문내역을 다시 조회해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="lookup-page">
      <style>{css}</style>
      <section className="lookup-card">
        <strong className="brand-kicker">build us care</strong>
        <p>주문내역 조회</p>
        <h1>이름과 전화번호로 주문을 찾습니다</h1>
        <span>최근 주문과 현재 진행 상태만 간단히 확인할 수 있습니다.</span>
        {isInstagram ? <div className="lookup-instagram-note">Instagram에서 보고 주문하셨다면, 결제 후 받은 주문 링크를 잃어버렸어도 여기서 다시 확인할 수 있어요.</div> : null}
        <form onSubmit={submit}>
          <OrderLookupForm
            name={name}
            phone={phone}
            loading={loading}
            onNameChange={setName}
            onPhoneChange={setPhone}
          />
        </form>
        {message && <div className={`lookup-message ${orders.length === 0 ? "empty" : ""}`}>{message}</div>}
        {message && orders.length === 0 && (
          <div className="lookup-secondary-actions" aria-label="주문 조회 보조 행동">
            <a href={photoHref}>사진 판정받기</a>
            <a href={servicesHref}>서비스별 정찰가 보기</a>
          </div>
        )}
      </section>
      <OrderLookupResults orders={orders} />
      <section className="lookup-kakao-banner">
        <div className="lookup-kakao-copy">
          <h2>주문을 찾기 어렵다면?</h2>
          <p>{kakaoUrl ? "카톡 상담으로 주문 정보를 확인해드릴게요." : "상담 채널 준비 중입니다."}</p>
        </div>
        {kakaoChatUrl ? (
          <a className="lookup-kakao-link" href={kakaoChatUrl} target="_blank" rel="noreferrer">
            <span className="kakao-mark" aria-hidden="true">TALK</span>
            카톡 상담
          </a>
        ) : (
          <button className="lookup-kakao-link" type="button" disabled>
            <span className="kakao-mark" aria-hidden="true">TALK</span>
            카톡 상담
          </button>
        )}
        {kakaoUrl && (
          <div className="lookup-kakao-qr" aria-label="카카오 상담 QR 코드">
            <img src="/kakao-channel-qr.png" alt="카카오 상담 채널 QR 코드" />
            <span>카톡상담 QR</span>
          </div>
        )}
      </section>
    </main>
  );
}

const css = `
  .lookup-page { min-height: 70vh; display: grid; justify-items: center; align-content: start; gap: var(--space-5, 1.25rem); padding: clamp(1.75rem, 4vw, 2.5rem) var(--space-4) var(--space-12); background: linear-gradient(90deg, rgba(34, 33, 29, 0.024) 1px, transparent 1px), linear-gradient(180deg, rgba(34, 33, 29, 0.024) 1px, transparent 1px), var(--color-bg); background-size: 34px 34px; }
  .lookup-card, .lookup-results, .lookup-kakao-banner { box-sizing: border-box; width: min(760px, 100%); border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); padding: clamp(20px, 3vw, 28px); box-shadow: 0 14px 34px rgba(34, 33, 29, 0.055); }
  .lookup-card { display: grid; gap: var(--space-4); }
  .lookup-card { background: linear-gradient(135deg, rgba(255, 250, 241, 0.96), rgba(244, 234, 212, 0.78)); }
  .brand-kicker { color: var(--color-text); font-family: var(--font-brand); font-size: 13px; font-weight: var(--brand-label-weight); letter-spacing: var(--brand-letter-spacing); text-transform: lowercase; }
  .lookup-card p { margin: 0; color: var(--color-primary); font-weight: 700; }
  .lookup-card h1 { margin: 0; font-size: var(--text-xl); font-weight: 700; line-height: 1.25; letter-spacing: 0; }
  .lookup-card span, .lookup-message { color: var(--color-text-muted); line-height: 1.55; }
  .lookup-instagram-note { border-radius: 8px; background: var(--color-primary-highlight); padding: var(--space-3) var(--space-4); color: var(--color-primary); font-weight: 700; line-height: 1.55; }
  .lookup-card form { display: grid; gap: var(--space-3); }
  .lookup-form-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(132px, 0.65fr); align-items: end; gap: var(--space-3); }
  .lookup-form-grid > * { min-width: 0; }
  .lookup-card label { display: grid; gap: 8px; font-weight: 700; }
  .lookup-card input { box-sizing: border-box; width: 100%; min-height: 52px; border: 1px solid var(--color-border); border-radius: 8px; padding: 0 14px; font-size: 16px; }
  .lookup-card button, .lookup-link { box-sizing: border-box; min-height: 52px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: var(--color-gold); color: #211c12; text-decoration: none; font-weight: 700; white-space: nowrap; }
  .lookup-form-grid button { width: 100%; padding: 0 16px; }
  .lookup-card button:disabled { opacity: 0.55; cursor: not-allowed; }
  .lookup-message { border-radius: 8px; background: var(--color-primary-highlight); padding: var(--space-3) var(--space-4); font-weight: 700; }
  .lookup-message.empty { background: var(--color-alert-soft); color: #7a371f; }
  .lookup-secondary-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .lookup-secondary-actions a { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--color-border); border-radius: var(--radius-full); padding: 0 var(--space-4); background: var(--color-surface); color: var(--color-text); text-decoration: none; font-size: var(--text-sm); font-weight: 700; }
  .lookup-secondary-actions a:first-child { border-color: var(--color-gold); background: var(--color-gold); color: #211c12; }
  .lookup-results { display: grid; gap: var(--space-4); }
  .lookup-results-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
  .lookup-results-head h2 { margin: 0; font-size: var(--text-lg); letter-spacing: 0; }
  .lookup-results-head span { color: var(--color-text-muted); font-weight: 700; }
  .lookup-order-list { display: grid; gap: var(--space-3); }
  .lookup-order-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--space-4); border: 1px solid var(--color-border); border-radius: 8px; padding: var(--space-4); background: var(--color-surface); }
  .lookup-order-number { color: var(--color-primary); font-size: var(--text-sm); font-weight: 700; }
  .lookup-order-card h3 { margin: var(--space-1) 0 var(--space-2); font-size: var(--text-base); letter-spacing: 0; }
  .lookup-badges { display: flex; flex-wrap: wrap; gap: 6px; }
  .lookup-badges span { border-radius: var(--radius-full); padding: 4px 9px; background: var(--color-primary-highlight); color: var(--color-primary); font-size: var(--text-xs); font-weight: 700; }
  .lookup-order-summary { margin: 0; color: var(--color-text-muted); font-size: var(--text-sm); font-weight: 700; line-height: 1.5; }
  .lookup-kakao-banner { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: var(--space-4); background: var(--color-sage-soft); }
  .lookup-kakao-copy { min-width: 0; }
  .lookup-kakao-banner h2 { margin: 0 0 4px; font-size: var(--text-base); line-height: 1.25; letter-spacing: 0; }
  .lookup-kakao-banner p { margin: 0; color: var(--color-text-muted); font-size: var(--text-sm); line-height: 1.55; }
  .lookup-kakao-link { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid var(--color-border); border-radius: 8px; padding: var(--space-2) 1.25rem; background: rgba(255, 250, 241, 0.86); color: var(--color-primary); text-decoration: none; font-size: var(--text-button); line-height: var(--leading-button); font-weight: 700; letter-spacing: -0.005em; white-space: nowrap; }
  .lookup-kakao-link .kakao-mark { display: inline-grid; place-items: center; min-width: 34px; height: 18px; border-radius: var(--radius-full); background: #fee500; color: #22211d; font-size: var(--text-caption); font-weight: 700; line-height: 1; letter-spacing: 0; }
  .lookup-kakao-link:disabled { opacity: 0.4; cursor: not-allowed; }
  .lookup-kakao-qr { display: grid; justify-items: center; gap: 6px; color: var(--color-text-muted); font-size: var(--text-xs); font-weight: 700; text-align: center; }
  .lookup-kakao-qr img { width: 88px; height: 88px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: #fff; }
  @media (max-width: 820px) {
    .lookup-form-grid, .lookup-order-card { grid-template-columns: 1fr; }
    .lookup-link { width: 100%; }
    .lookup-kakao-banner { grid-template-columns: 1fr; }
    .lookup-kakao-qr { display: none; }
    .lookup-kakao-link { width: 100%; }
  }
`;
