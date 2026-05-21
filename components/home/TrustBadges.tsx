"use client";

import { BadgeCheck, FileText, Shield, UserCheck } from "lucide-react";

const badges = [
  { title: "표준 시공 9종", description: "자주 찾는 교체·수리를 먼저 정찰가로 운영", Icon: BadgeCheck },
  { title: "1년 A/S", description: "검수 완료 후 1년간 A/S 접수 가능", Icon: Shield },
  { title: "기사 작업 기록", description: "전·중·후 사진과 실제 소요시간을 남겨요", Icon: UserCheck },
  { title: "추가비용 사전 안내", description: "예약 전 견적과 옵션 금액을 먼저 확인", Icon: FileText }
];

export function TrustBadges() {
  return (
    <section className="home-section trust-section">
      {badges.map(({ title, description, Icon }) => (
        <div key={title} className="trust-badge">
          <Icon size={22} strokeWidth={2.1} />
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
      ))}
    </section>
  );
}
