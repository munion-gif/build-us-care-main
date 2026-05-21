"use client";

import { FileText, ShieldCheck, Timer } from "lucide-react";

const items = [
  { title: "가격 먼저", body: "정찰가 가능 작업은 결제 전 총액 확인", Icon: FileText },
  { title: "상태 확인", body: "주문 링크에서 배정·방문 단계 확인", Icon: Timer },
  { title: "A/S 접수", body: "완료 후 불편하면 같은 링크에서 접수", Icon: ShieldCheck }
];

export function TrustMiniStrip() {
  return (
    <section className="trust-mini-strip" aria-label="핵심 안심 포인트">
      {items.map(({ title, body, Icon }) => (
        <div key={title}>
          <Icon size={18} aria-hidden="true" />
          <strong>{title}</strong>
          <span>{body}</span>
        </div>
      ))}
    </section>
  );
}
