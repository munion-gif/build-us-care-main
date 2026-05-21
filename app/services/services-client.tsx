"use client";

import Link from "next/link";
import { CheckCircle2, Clock, DoorOpen, Droplets, Lightbulb, Pipette, Plug, Waves, Wind, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { QuoteServiceItem } from "@/lib/service-items";
import { appendSourceParams, readClientSourceContext, type SourceContext } from "@/lib/traffic-source";

type ServicesClientProps = {
  services: QuoteServiceItem[];
};

const tabs = ["전체", "욕실", "주방", "전기·조명", "도어·손잡이"] as const;
const hiddenServiceCodes = new Set<string>(["drain_clog", "partial_wallpaper"]);

const categoryByCode: Record<string, (typeof tabs)[number]> = {
  toilet_replace: "욕실",
  faucet_replace: "욕실",
  bidet_install: "욕실",
  light_replace: "전기·조명",
  outlet_replace: "전기·조명",
  ventilator_replace: "전기·조명",
  door_handle: "도어·손잡이"
};

const icons: Record<string, LucideIcon> = {
  toilet_replace: Droplets,
  faucet_replace: Pipette,
  light_replace: Lightbulb,
  outlet_replace: Plug,
  door_handle: DoorOpen,
  bidet_install: Waves,
  ventilator_replace: Wind
};

function priceLabel(service: QuoteServiceItem) {
  if (!service.standardizable || service.base_price === 0) return "현장 확인 후 안내";
  return `${service.base_price.toLocaleString("ko-KR")}원`;
}

export function ServicesClient({ services }: ServicesClientProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("전체");
  const [sourceContext, setSourceContext] = useState<SourceContext>(() => readClientSourceContext());
  const filtered = useMemo(
    () =>
      services.filter(
        (service) =>
          !hiddenServiceCodes.has(service.service_type_code) &&
          (activeTab === "전체" || categoryByCode[service.service_type_code] === activeTab)
      ),
    [activeTab, services]
  );
  const photoHref = appendSourceParams("/request/photo", sourceContext);

  useEffect(() => {
    setSourceContext(readClientSourceContext());
  }, []);

  return (
    <main className="services-page">
      <style>{servicesCss}</style>
      <section className="services-hero">
        <strong className="brand-kicker">build us care</strong>
        <span>서비스별 정찰가</span>
        <h1>교체가 필요하면 가격과 예약까지 바로 확인하세요</h1>
        <p>먼저 사진으로 호환가능한 제품과 방문없는 견적을 받아보세요.</p>
        <div className="services-hero-actions">
          <Link href={photoHref}>사진확인</Link>
        </div>
      </section>

      <section className="services-flow" aria-label="서비스 진행 흐름">
        {[
          ["사진", "교체 가능 및 호환 제품확인"],
          ["견적", "정찰가와 옵션 확인"],
          ["예약", "방문일 선택"],
          ["상태", "주문 링크에서 확인"]
        ].map(([title, body]) => (
          <div key={title}>
            <strong>{title}</strong>
            <span>{body}</span>
          </div>
        ))}
      </section>

      <section className="service-tabs" aria-label="서비스 카테고리">
        {tabs.map((tab) => (
          <button key={tab} type="button" className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </section>

      <section className="service-list-grid" id="service-list">
        {filtered.map((service) => {
          const Icon = icons[service.service_type_code] ?? Droplets;
          const category = categoryByCode[service.service_type_code] ?? "전체";
          const included = service.included_items.slice(0, 2);
          return (
            <Link key={service.service_type_code} className="service-list-card" href={appendSourceParams(`/quote/${service.service_type_code}`, sourceContext)}>
              <div className="service-card-top">
                <div className="service-icon">
                  <Icon size={20} />
                </div>
                <div>
                  <h2>{service.display_name}</h2>
                  <span>{category}</span>
                </div>
              </div>
              <div className="service-price">
                <strong>{priceLabel(service)}</strong>
                {service.standardizable && service.base_price > 0 && <small>부터</small>}
              </div>
              <ul>
                {included.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="service-time">
                <Clock size={16} />
                약 {service.estimated_minutes ?? 60}분
              </p>
              <span className="quote-link">견적 보기 →</span>
            </Link>
          );
        })}
      </section>

    </main>
  );
}

const servicesCss = `
  .services-page {
    min-height: 100vh;
    width: min(var(--content-wide), 100%);
    margin-inline: auto;
    padding: var(--space-12) var(--space-6);
    background: var(--color-bg);
  }
  .services-hero {
    position: relative;
    overflow: hidden;
    margin-bottom: var(--space-8);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: clamp(22px, 4vw, 36px);
    background:
      linear-gradient(135deg, rgba(255, 250, 241, 0.98) 0%, rgba(247, 241, 230, 0.96) 52%, rgba(228, 232, 223, 0.82) 100%);
    box-shadow: var(--shadow-sm);
  }
  .services-hero > * {
    position: relative;
    z-index: 1;
  }
  .brand-kicker {
    display: block;
    margin-bottom: 18px;
    color: var(--color-text);
    font-family: var(--font-brand);
    font-size: 13px;
    font-weight: var(--brand-label-weight);
    letter-spacing: var(--brand-letter-spacing);
    text-transform: lowercase;
  }
  .services-hero span {
    color: var(--color-primary);
    font-size: var(--text-sm);
    font-weight: 620;
  }
  .services-hero h1 {
    margin: 0 0 var(--space-3);
    max-width: 760px;
    font-size: clamp(1.45rem, 2.35vw, 2.08rem);
    font-weight: 640;
    letter-spacing: 0;
    line-height: 1.24;
  }
  .services-hero p {
    max-width: 620px;
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: 1.65;
  }
  .services-hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-6);
  }
  .services-hero-actions a {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    padding: 0 var(--space-5, 1.25rem);
    background: var(--color-primary);
    color: var(--color-cream);
    font-size: var(--text-sm);
    font-weight: 680;
    text-decoration: none;
  }
  .services-flow {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-2);
    margin-bottom: var(--space-6);
  }
  .services-flow div {
    display: grid;
    gap: 4px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: rgba(255, 250, 241, 0.86);
    padding: 14px 16px;
  }
  .services-flow div:nth-child(2) {
    background: rgba(255, 250, 241, 0.86);
  }
  .services-flow div:nth-child(3) {
    background: var(--color-sage-soft);
  }
  .services-flow div:nth-child(4) {
    background: rgba(255, 250, 241, 0.86);
  }
  .services-flow strong {
    color: var(--color-primary);
    font-size: 0.94rem;
    font-weight: 660;
  }
  .services-flow span {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    line-height: 1.45;
  }
  .service-tabs {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    padding-bottom: var(--space-2);
    margin-bottom: var(--space-6);
    scrollbar-width: none;
  }
  .service-tabs::-webkit-scrollbar {
    display: none;
  }
  .service-tabs button {
    flex: 0 0 auto;
    border: 0;
    border-radius: 8px;
    padding: 0.42rem 1rem;
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    font-size: 0.92rem;
    font-weight: 600;
    cursor: pointer;
  }
  .service-tabs button.active {
    background: var(--color-charcoal-panel);
    color: var(--color-cream);
  }
  .service-list-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }
  .service-list-card {
    display: grid;
    gap: 14px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: rgba(255, 250, 241, 0.9);
    padding: 18px;
    color: var(--color-text);
    text-decoration: none;
    box-shadow: 0 4px 14px rgba(34, 33, 29, 0.025);
    transition: box-shadow var(--transition), transform var(--transition), border-color var(--transition);
  }
  .service-list-card:hover {
    border-color: rgba(168, 176, 162, 0.72);
    box-shadow: var(--shadow-sm);
    transform: translateY(-2px);
  }
  .service-card-top {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }
  .service-icon {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-sm);
    background: var(--color-primary-highlight);
    color: var(--color-primary);
  }
  .service-list-card:nth-child(3n + 1) .service-icon {
    background: var(--color-gold-wash);
  }
  .service-list-card:nth-child(3n + 2) .service-icon {
    background: var(--color-sage-soft);
  }
  .service-list-card:nth-child(3n) .service-icon {
    background: var(--color-charcoal-panel);
    color: var(--color-cream);
  }
  .service-card-top h2 {
    margin: 0 0 var(--space-2);
    font-size: clamp(1.02rem, 1.22vw, 1.2rem);
    font-weight: 650;
    line-height: 1.28;
  }
  .service-card-top span {
    border-radius: var(--radius-full);
    padding: 3px 9px;
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 620;
  }
  .service-price strong {
    font-size: clamp(1.38rem, 1.95vw, 1.78rem);
    font-weight: 650;
    letter-spacing: 0;
  }
  .service-price small {
    margin-left: var(--space-1);
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }
  .service-list-card ul {
    display: grid;
    gap: var(--space-2);
    padding: 0;
    margin: 0;
    list-style: none;
  }
  .service-list-card li,
  .service-time {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
  .service-list-card li svg,
  .service-time svg {
    color: var(--color-primary);
    flex: 0 0 auto;
  }
  .quote-link {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-primary);
    font-size: var(--text-sm);
    font-weight: 680;
  }
  @media (max-width: 640px) {
    .services-page {
      padding: 2.25rem 18px 4.75rem;
    }
    .services-hero {
      margin-bottom: 1.75rem;
      padding: 1.75rem 1.35rem;
    }
    .services-hero h1 {
      line-height: 1.3;
    }
    .services-hero p {
      line-height: 1.7;
    }
    .services-flow {
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .services-flow div {
      padding: 1rem;
    }
    .service-tabs {
      flex-wrap: wrap;
      overflow-x: visible;
      gap: 0.625rem;
      margin-bottom: 1.5rem;
      padding-bottom: 0;
    }
    .service-tabs button {
      flex: 1 1 calc(50% - 0.625rem);
      min-height: 40px;
    }
    .service-list-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    .service-list-card {
      padding: 1.25rem;
    }
  }
  @media (min-width: 641px) and (max-width: 920px) {
    .service-list-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (min-width: 921px) and (max-width: 1180px) {
    .service-list-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
`;
