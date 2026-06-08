"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  DoorOpen,
  Droplets,
  Fan,
  Paintbrush,
  PanelsTopLeft,
  Shapes,
  ShowerHead,
  SoapDispenserDroplet,
  Toilet,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PUBLIC_SERVICE_CODE_SET } from "@/lib/public-services";
import type { QuoteServiceItem } from "@/lib/service-items";
import { appendSourceParams, readClientSourceContext, type SourceContext } from "@/lib/traffic-source";

type ServicesClientProps = {
  services: QuoteServiceItem[];
};

type ServiceCategory = "욕실" | "주방" | "도어·손잡이";

const categoriesByCode: Record<string, ServiceCategory[]> = {
  toilet_replace: ["욕실"],
  basin_replace: ["욕실"],
  faucet_replace: ["욕실", "주방"],
  bidet_install: ["욕실"],
  ventilator_replace: ["욕실"],
  sash_handle: ["도어·손잡이"],
  door_handle: ["도어·손잡이"],
  silicone_repair: ["욕실"],
  bath_accessory: ["욕실"]
};

const icons: Record<string, LucideIcon> = {
  toilet_replace: Toilet,
  basin_replace: SoapDispenserDroplet,
  faucet_replace: ShowerHead,
  bidet_install: Droplets,
  ventilator_replace: Fan,
  sash_handle: PanelsTopLeft,
  door_handle: DoorOpen,
  silicone_repair: Paintbrush,
  bath_accessory: Shapes
};

const flowSteps = [
  { title: "사진", body: "제품 호환 확인" },
  { title: "견적", body: "제품가·시공비 확인" },
  { title: "예약", body: "방문 일정 선택" },
  { title: "교체", body: "방문 후 시공 완료" }
];

function priceLabel(service: QuoteServiceItem) {
  if (!service.standardizable || service.base_price === 0) return "현장 확인 후 안내";
  return `${service.base_price.toLocaleString("ko-KR")}원`;
}

export function ServicesClient({ services }: ServicesClientProps) {
  const [sourceContext, setSourceContext] = useState<SourceContext>(() => readClientSourceContext());
  const filtered = useMemo(
    () => services.filter((service) => PUBLIC_SERVICE_CODE_SET.has(service.service_type_code)),
    [services]
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
        <p>먼저 사진으로 호환가능한 제품을 확인하고, 투명한 견적을 받아보세요.</p>
        <div className="services-hero-actions">
          <Link href={photoHref}>사진확인</Link>
        </div>
      </section>

      <section className="services-flow" aria-label="서비스 진행 흐름">
        <ol className="services-flow-list">
          {flowSteps.map(({ title, body }, index) => (
            <li key={title} className="services-flow-step">
              <span className="services-flow-copy">
                <strong>{title}</strong>
                <span>{body}</span>
              </span>
              {index < flowSteps.length - 1 && <span className="services-flow-arrow" aria-hidden="true">→</span>}
            </li>
          ))}
        </ol>
      </section>

      <section className="service-list-grid" id="service-list">
        {filtered.map((service) => {
          const Icon = icons[service.service_type_code] ?? ShowerHead;
          const category = categoriesByCode[service.service_type_code]?.join("·") ?? "서비스";
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
    padding: clamp(2rem, 4vw, 2.75rem) var(--space-6) var(--space-12);
    background: var(--color-bg);
  }
  .services-hero {
    position: relative;
    overflow: hidden;
    margin-bottom: var(--space-6);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: clamp(22px, 3vw, 30px);
    background: #ffffff;
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
    font-size: var(--text-label);
    line-height: var(--leading-label);
    font-weight: var(--brand-label-weight);
    letter-spacing: var(--brand-letter-spacing);
    text-transform: lowercase;
  }
  .services-hero span {
    color: var(--color-primary);
    font-size: var(--text-label);
    line-height: var(--leading-label);
    font-weight: 600;
  }
  .services-hero h1 {
    margin: 0 0 var(--space-3);
    max-width: 760px;
    font-size: var(--text-xl);
    line-height: var(--leading-xl);
    font-weight: 700;
    letter-spacing: 0;
    word-break: keep-all;
    overflow-wrap: break-word;
  }
  .services-hero p {
    max-width: 620px;
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-body);
    line-height: var(--leading-body);
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
    border-radius: 999px;
    padding: 0 var(--space-5, 1.25rem);
    background: var(--color-primary);
    color: #ffffff;
    font-size: var(--text-button);
    line-height: var(--leading-button);
    font-weight: 700;
    letter-spacing: 0;
    text-decoration: none;
  }
  .services-flow {
    margin-bottom: var(--space-6);
  }
  .services-flow-list {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0;
    margin: 0;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: #ffffff;
    list-style: none;
    box-shadow: 0 4px 14px rgba(16, 24, 40, 0.035);
  }
  .services-flow-step {
    position: relative;
    min-width: 0;
    padding: 16px 20px;
  }
  .services-flow-step + .services-flow-step {
    border-left: 1px solid var(--color-border);
  }
  .services-flow-copy {
    display: grid;
    gap: 4px;
    min-width: 0;
  }
  .services-flow-arrow {
    position: absolute;
    top: 50%;
    right: -11px;
    z-index: 2;
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: var(--color-bg);
    color: var(--color-text-muted);
    font-size: 15px;
    line-height: 1;
    font-weight: 700;
    transform: translateY(-50%);
  }
  .services-flow-copy strong {
    color: var(--color-text);
    font-size: var(--text-body);
    line-height: var(--leading-body);
    font-weight: 700;
    word-break: keep-all;
  }
  .services-flow-copy span {
    color: var(--color-text-muted);
    font-size: var(--text-label);
    line-height: var(--leading-label);
    font-weight: 600;
    word-break: keep-all;
  }
  .service-list-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }
  .service-list-card {
    display: grid;
    gap: 14px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: #ffffff;
    padding: 18px;
    color: var(--color-text);
    text-decoration: none;
    box-shadow: 0 4px 14px rgba(16, 24, 40, 0.035);
    transition: box-shadow var(--transition), transform var(--transition), border-color var(--transition);
  }
  .service-list-card:hover {
    border-color: #b2ddff;
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
    background: var(--color-primary);
    color: #ffffff;
  }
  .service-card-top h2 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-card-title);
    line-height: var(--leading-card-title);
    font-weight: 700;
    letter-spacing: 0;
  }
  .service-card-top span {
    border-radius: var(--radius-full);
    padding: 3px 9px;
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    font-size: var(--text-label);
    line-height: var(--leading-label);
    font-weight: 600;
  }
  .service-price strong {
    font-size: var(--text-price-sub);
    line-height: var(--leading-price-sub);
    font-weight: 600;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }
  .service-price small {
    margin-left: var(--space-1);
    color: var(--color-text-muted);
    font-size: var(--text-body-sm);
    line-height: var(--leading-body-sm);
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
    font-size: var(--text-body-sm);
    line-height: var(--leading-body-sm);
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
    border: 1.5px solid var(--color-primary);
    border-radius: 999px;
    background: var(--color-primary);
    color: #ffffff;
    font-size: var(--text-button);
    line-height: var(--leading-button);
    font-weight: 700;
  }
  .service-list-card:hover .quote-link {
    border-color: var(--color-primary);
    background: var(--color-primary-hover);
    color: #ffffff;
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
      font-size: var(--text-h1);
      line-height: var(--leading-h1);
    }
    .services-hero p {
      line-height: 1.7;
    }
    .services-flow {
      margin-bottom: 1.5rem;
    }
    .services-flow-list {
      grid-template-columns: 1fr;
      border-radius: 8px;
    }
    .services-flow-step {
      padding: 13px 16px;
      text-align: center;
    }
    .services-flow-step + .services-flow-step {
      border-left: 0;
      border-top: 1px solid var(--color-border);
    }
    .services-flow-arrow {
      top: auto;
      right: auto;
      bottom: -11px;
      left: 50%;
      content: "↓";
      transform: translateX(-50%);
    }
    .services-flow-arrow {
      font-size: 0;
    }
    .services-flow-arrow::before {
      content: "↓";
      font-size: 15px;
      line-height: 1;
    }
    .services-flow-copy {
      justify-items: center;
    }
    .services-flow-copy span {
      display: none;
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
