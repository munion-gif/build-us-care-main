"use client";

import { AlertTriangle, DoorOpen, Droplets, Layers, Lightbulb, Pipette, Plug, Waves, Wind, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { QuoteServiceItem } from "@/lib/service-items";

type ServiceCardProps = {
  service: QuoteServiceItem;
  href: string;
  cardRef?: (node: HTMLAnchorElement | null) => void;
  onClick?: () => void;
};

const icons: Record<string, LucideIcon> = {
  toilet_replace: Droplets,
  faucet_replace: Pipette,
  light_replace: Lightbulb,
  outlet_replace: Plug,
  door_handle: DoorOpen,
  bidet_install: Waves,
  ventilator_replace: Wind,
  drain_clog: AlertTriangle,
  partial_wallpaper: Layers
};

const descriptions: Record<string, string> = {
  toilet_replace: "양변기 철거·설치와 누수 테스트까지 진행해요.",
  faucet_replace: "주방·욕실 수전 교체를 정찰가로 확인해요.",
  light_replace: "등기구 교체와 점등 확인까지 처리해요.",
  outlet_replace: "콘센트 교체와 전기 안전 확인을 함께 해요.",
  door_handle: "문 손잡이 교체와 문 닫힘 상태를 확인해요.",
  bidet_install: "비데 설치와 급수 연결 상태를 점검해요.",
  ventilator_replace: "욕실 환풍기 교체와 작동 테스트를 진행해요.",
  drain_clog: "막힘 정도를 사진으로 확인한 뒤 상담해요.",
  partial_wallpaper: "부분 도배 범위를 확인하고 견적을 안내해요."
};

export function ServiceCard({ service, href, cardRef, onClick }: ServiceCardProps) {
  const Icon = icons[service.service_type_code] ?? Droplets;

  return (
    <Link ref={cardRef} className="service-card" href={href} prefetch={true} onClick={onClick}>
      <div className="service-icon" aria-hidden="true">
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <div>
        <div className="service-title-row">
          <h3>{service.display_name}</h3>
          <span>{service.standardizable ? "정찰가 가능" : "상담 필요"}</span>
        </div>
        <p className="service-description">{descriptions[service.service_type_code] ?? "사진과 주소를 남기면 견적을 안내해요."}</p>
        <p>{service.standardizable ? `${service.base_price.toLocaleString("ko-KR")}원~` : "상담 후 안내"}</p>
        <div className="service-meta-row">
          <small>약 {service.estimated_minutes ?? 60}분</small>
          <span>견적 확인</span>
        </div>
      </div>
    </Link>
  );
}
