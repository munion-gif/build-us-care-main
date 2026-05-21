"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { EVENT_TYPES } from "@/lib/event-types";
import type { FAQItem } from "@/lib/faqs";
import type { QuoteServiceItem } from "@/lib/service-items";
import { appendSourceParams, readClientSourceContext, type SourceContext } from "@/lib/traffic-source";
import { useTracking } from "@/lib/use-tracking";

type HomeClientProps = {
  services: QuoteServiceItem[];
  kakaoUrl: string | null;
  faqs: FAQItem[];
};

const TRUST_ITEMS = [
  {
    label: "price",
    title: "견적 무료",
    body: "확인 후 결제"
  },
  {
    label: "consent",
    title: "추가비용 사전동의",
    body: "작업 전 안내"
  },
  {
    label: "warranty",
    title: "1년 A/S",
    body: "주문 링크 접수"
  }
];

export function HomeClient({ services, kakaoUrl, faqs }: HomeClientProps) {
  const [sourceContext, setSourceContext] = useState<SourceContext>({
    trafficSource: "direct",
    isInstagram: false
  });
  const { track } = useTracking();

  useEffect(() => {
    const nextContext = readClientSourceContext();
    setSourceContext(nextContext);

    if (nextContext.isInstagram) {
      void track(EVENT_TYPES.INSTAGRAM_LANDING_VIEW, {
        source: nextContext.trafficSource,
        utm_source: nextContext.source,
        utm_campaign: nextContext.campaign,
        landing_path: nextContext.landingPath
      });
    }
  }, []);

  const photoHref = useMemo(() => appendSourceParams("/request/photo", sourceContext), [sourceContext]);
  const ordersHref = useMemo(() => appendSourceParams("/orders/lookup", sourceContext), [sourceContext]);
  const casesHref = useMemo(() => appendSourceParams("/cases", sourceContext), [sourceContext]);
  const representativeServices = useMemo(
    () => services.filter((service) => service.standardizable).slice(0, 6),
    [services]
  );
  const visibleFaqs = useMemo(() => faqs.slice(0, 6), [faqs]);

  return (
    <main className="home-page">
      <style>{homeCss}</style>

      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          {sourceContext.isInstagram ? <span className="small-label">instagram photo diagnosis</span> : null}
          <span className="brand-kicker">build us care</span>
          <h1 id="home-title">사진 3장으로 제품 호환 확인하기</h1>
          <p>
            방문은 교체가 필요할 때만 진행합니다. 변기, 수전, 조명, 콘센트처럼 제품 호환이
            애매한 작업을 사진으로 먼저 확인하고 견적과 예약까지 이어갑니다.
          </p>
          <div className="quick-picks" aria-label="대표 서비스 바로가기">
            <span>대표 항목</span>
            <div>
              {representativeServices.slice(0, 4).map((service) => (
                <a key={service.service_type_code} href={appendSourceParams(`/quote/${service.service_type_code}`, sourceContext)}>
                  {service.display_name}
                </a>
              ))}
            </div>
          </div>
          <div className="hero-actions">
            <a
              className="primary-action"
              href={photoHref}
              onClick={() =>
                void track(EVENT_TYPES.SERVICE_CARD_CLICK, {
                  service_code: "photo_diagnosis",
                  source: sourceContext.trafficSource,
                  utm_source: sourceContext.source,
                  utm_campaign: sourceContext.campaign,
                  service_flow: "photo"
                })
              }
            >
              사진확인 <ChevronRight size={18} />
            </a>
            <a className="secondary-action" href={casesHref}>시공 사례 보기</a>
            {kakaoUrl ? (
              <a className="secondary-action kakao-action" href={kakaoUrl} target="_blank" rel="noreferrer">
                카톡 상담
              </a>
            ) : null}
          </div>
        </div>

        <div className="hero-visual" aria-label="사진 제품 호환 확인 예시">
          <div className="diagnosis-label">
            <span>build us care</span>
            <strong>photo diagnosis</strong>
            <small>사진 3장 먼저 확인</small>
            <dl>
              <div><dt>photos</dt><dd>3장 필요</dd></div>
              <div><dt>check</dt><dd>제품 호환</dd></div>
              <div><dt>estimate</dt><dd>견적 안내</dd></div>
            </dl>
          </div>
          <div className="visual-note">
            <span>photo compatibility check</span>
            <strong>방문 없이 사진으로 먼저 판단하고, 호환 가능 제품 확인 및 견적까지 안내합니다.</strong>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="빌드어스 케어 신뢰 기준">
        {TRUST_ITEMS.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </article>
        ))}
      </section>

      <section className="home-section service-section" aria-labelledby="services-title">
        <div className="section-head">
          <span>replaceable product check</span>
          <h2 id="services-title">사진으로 먼저 확인하는 대표 서비스</h2>
          <p>작은 생활 설비 교체를 기준으로, 판정 가능한 항목부터 견적까지 연결합니다.</p>
        </div>
        {representativeServices.length > 0 ? (
          <div className="service-grid">
            {representativeServices.map((service) => (
              <a
                className="service-card"
                key={service.service_type_code}
                href={appendSourceParams(`/quote/${service.service_type_code}`, sourceContext)}
              >
                <small>{service.category}</small>
                <p>{service.display_name}</p>
                <span className="service-description">{service.photo_guide ?? "전체 사진 / 문제 부위 / 주변 환경 사진"}</span>
                <div className="service-meta-row">
                  <span>{service.standardizable ? "제품 호환 확인 가능" : "상담 필요"}</span>
                  <ChevronRight size={16} />
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="empty-service">
            <p>현재 표시할 대표 서비스가 없습니다.</p>
            <a href={photoHref}>제품 호환 확인으로 문의하기</a>
          </div>
        )}
      </section>

      <section className="quick-flow-board" aria-labelledby="flow-title">
        <div className="section-head flow-head">
          <span>이용 흐름</span>
          <h2 id="flow-title">사진 확인부터 A/S까지 한 흐름으로</h2>
          <p>방문 전에 먼저 확인하고, 가능한 작업만 견적과 교체 일정으로 이어갑니다.</p>
        </div>
        <ol className="quick-flow-steps">
          <li>
            <b>1</b>
            <strong>사진 확인</strong>
            <span>방문 없이 전체 사진과 문제 부위 사진으로 제품 호환 여부를 먼저 확인합니다.</span>
          </li>
          <li>
            <b>2</b>
            <strong>견적 확인</strong>
            <span>호환 가능하면 필요한 제품, 공임, 추가 가능 항목을 정리해 안내합니다.</span>
          </li>
          <li>
            <b>3</b>
            <strong>교체와 사후관리</strong>
            <span>견적 확인 후 방문해 교체하고, 완료 이후 주문 링크에서 A/S까지 접수합니다.</span>
          </li>
        </ol>
      </section>

      {visibleFaqs.length > 0 ? (
        <section className="home-section faq-section" aria-labelledby="faq-title">
          <div className="section-head">
            <span>FAQ</span>
            <h2 id="faq-title">신청 전에 자주 확인하는 내용</h2>
            <p>사진 확인, 카톡 상담, 추가비용, 예약/A/S 기준을 먼저 확인하세요.</p>
          </div>
          <div className="faq-list">
            {visibleFaqs.map((faq) => (
              <details key={faq.id}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <nav className="bottom-cta" aria-label="빠른 신청">
        <a href={photoHref}>사진확인</a>
        <a href={ordersHref}>주문 조회</a>
      </nav>
    </main>
  );
}

const homeCss = `
  .home-page {
    --cream: var(--color-cream);
    --paper: var(--color-surface);
    --charcoal: var(--color-text);
    --gold: var(--color-gold);
    --warm-gray: var(--color-border);
    --sage: var(--color-sage);
    min-height: 100vh;
    padding: 0 clamp(14px, 3vw, 40px) 92px;
    background: var(--cream);
    color: var(--charcoal);
  }
  .home-hero,
  .trust-strip,
  .home-section,
  .quick-flow-board {
    width: min(1120px, 100%);
    margin: 0 auto clamp(2rem, 4vw, 3.5rem);
  }
  .home-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.02fr) minmax(340px, 0.88fr);
    gap: clamp(1.5rem, 5vw, 4rem);
    align-items: center;
    padding-block: clamp(3rem, 6.2vw, 4.85rem);
  }
  .hero-copy {
    min-width: 0;
  }
  .brand-kicker,
  .small-label {
    display: block;
    margin-bottom: 18px;
    color: rgba(34, 33, 29, 0.68);
    font-family: var(--font-brand);
    font-size: 12px;
    font-weight: var(--brand-label-weight);
    letter-spacing: var(--brand-letter-spacing);
    text-transform: lowercase;
  }
  .small-label {
    width: fit-content;
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    border-radius: 8px;
    padding: 0 11px;
    background: rgba(168, 176, 162, 0.2);
    color: rgba(34, 33, 29, 0.72);
    letter-spacing: 0.04em;
  }
  .home-hero h1 {
    max-width: 16ch;
    margin: 0 0 var(--space-3);
    font-size: clamp(2.65rem, 5.7vw, 5.05rem);
    font-weight: 500;
    line-height: 1.07;
    letter-spacing: 0;
    word-break: keep-all;
  }
  .home-hero p,
  .section-head p,
  .service-card small,
  .service-description {
    color: rgba(34, 33, 29, 0.64);
    line-height: 1.55;
  }
  .home-hero p {
    max-width: 35rem;
    margin: 0;
    font-size: var(--text-base);
    font-weight: 520;
  }
  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-6);
  }
  .hero-actions a,
  .hero-actions button,
  .empty-service a {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 999px;
    padding: 0 18px;
    text-decoration: none;
    font-size: var(--text-sm);
    font-weight: 680;
  }
  .primary-action,
  .empty-service a {
    border: 1px solid var(--charcoal);
    background: var(--charcoal);
    color: var(--cream);
  }
  .secondary-action {
    border: 1px solid rgba(34, 33, 29, 0.16);
    background: rgba(255, 250, 241, 0.72);
    color: var(--charcoal);
  }
  .quick-picks {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-4);
    color: rgba(34, 33, 29, 0.54);
    font-size: var(--text-sm);
    font-weight: 620;
  }
  .quick-picks > div {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .quick-picks a {
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--warm-gray);
    border-radius: 999px;
    padding: 0 11px;
    background: rgba(255, 250, 241, 0.66);
    color: rgba(34, 33, 29, 0.7);
    text-decoration: none;
    font-size: var(--text-xs);
    font-weight: 640;
  }
  .hero-visual {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 22px;
    min-height: 390px;
    overflow: hidden;
    padding: 22px 18px 18px;
    border: 1px solid rgba(217, 210, 196, 0.95);
    border-radius: 8px;
    background:
      linear-gradient(90deg, rgba(168, 176, 162, 0.16) 0 1px, transparent 1px 100%),
      radial-gradient(circle at 72% 22%, rgba(255, 250, 241, 0.88), transparent 34%),
      linear-gradient(135deg, #fffaf1, #eee7da);
    background-size: 56px 100%, auto, auto;
    box-shadow: 0 12px 30px rgba(34, 33, 29, 0.04);
  }
  .diagnosis-label {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(170px, 0.78fr);
    gap: 10px 18px;
    border: 1px solid rgba(217, 210, 196, 0.95);
    border-radius: 10px;
    padding: 20px;
    background: rgba(255, 250, 241, 0.92);
    backdrop-filter: blur(12px);
  }
  .diagnosis-label > span {
    grid-column: 1 / -1;
    color: rgba(34, 33, 29, 0.6);
    font-family: var(--font-brand);
    font-size: 12px;
    font-weight: var(--brand-label-weight);
    letter-spacing: 0.32em;
    text-transform: lowercase;
  }
  .diagnosis-label strong {
    font-family: var(--font-brand);
    font-size: clamp(1.66rem, 3.6vw, 2.45rem);
    font-weight: 360;
    line-height: 1;
  }
  .diagnosis-label small {
    align-self: end;
    color: rgba(34, 33, 29, 0.62);
    font-size: var(--text-sm);
    font-weight: 560;
  }
  .diagnosis-label dl {
    grid-column: 1 / -1;
    display: grid;
    margin: 8px 0 0;
  }
  .diagnosis-label div {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr);
    gap: 10px;
    padding: 8px 0;
    border-top: 1px solid rgba(217, 210, 196, 0.95);
  }
  .diagnosis-label dt,
  .diagnosis-label dd {
    margin: 0;
    font-size: 12px;
    font-weight: 650;
    text-transform: uppercase;
  }
  .diagnosis-label dt {
    color: rgba(34, 33, 29, 0.58);
  }
  .visual-note {
    position: relative;
    z-index: 1;
    margin-top: auto;
    display: grid;
    gap: 6px;
    border: 1px solid rgba(255, 250, 241, 0.5);
    border-radius: 8px;
    padding: 16px;
    background: rgba(34, 33, 29, 0.78);
    color: #fffaf1;
  }
  .visual-note span {
    color: rgba(255, 250, 241, 0.64);
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0.16em;
    text-transform: lowercase;
  }
  .visual-note strong {
    font-size: var(--text-base);
    line-height: 1.35;
    word-break: keep-all;
  }
  .trust-strip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
    margin-top: clamp(-1.35rem, -2vw, -0.75rem);
  }
  .trust-strip article {
    min-height: 62px;
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px solid rgba(217, 210, 196, 0.95);
    border-radius: 8px;
    padding: 12px 14px;
    background: rgba(255, 250, 241, 0.78);
    box-shadow: 0 5px 16px rgba(34, 33, 29, 0.025);
  }
  .trust-strip span {
    width: 8px;
    height: 8px;
    flex: 0 0 auto;
    overflow: hidden;
    border-radius: 999px;
    background: var(--sage);
    color: transparent;
    font-size: 0;
  }
  .trust-strip strong {
    color: var(--charcoal);
    font-size: var(--text-sm);
    font-weight: 680;
    line-height: 1.32;
  }
  .trust-strip p {
    margin: 0;
    color: rgba(34, 33, 29, 0.62);
    font-size: var(--text-xs);
    font-weight: 520;
    line-height: 1.3;
  }
  .service-card:hover,
  .service-card:focus-visible {
    border-color: rgba(168, 176, 162, 0.72);
    box-shadow: 0 10px 26px rgba(34, 33, 29, 0.055);
    transform: translateY(-2px);
    outline: 0;
  }
  .home-section,
  .quick-flow-board {
    border: 1px solid rgba(217, 210, 196, 0.95);
    border-radius: 8px;
    background: rgba(255, 250, 241, 0.68);
    box-shadow: 0 6px 18px rgba(34, 33, 29, 0.025);
  }
  .service-section {
    padding: clamp(18px, 3vw, 26px);
  }
  .section-head {
    display: grid;
    gap: 6px;
    margin-bottom: var(--space-4);
  }
  .section-head span {
    width: fit-content;
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    border-radius: 8px;
    padding: 0 11px;
    background: rgba(168, 176, 162, 0.18);
    color: rgba(34, 33, 29, 0.7);
    font-size: var(--text-xs);
    font-weight: 680;
  }
  .section-head h2 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 660;
  }
  .section-head p {
    margin: 0;
    font-size: var(--text-sm);
  }
  .service-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .service-card {
    min-height: 158px;
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(217, 210, 196, 0.95);
    border-radius: 8px;
    padding: 18px;
    background: rgba(255, 250, 241, 0.82);
    color: var(--charcoal);
    text-decoration: none;
    transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
  }
  .service-card small {
    font-family: var(--font-brand);
    font-size: var(--text-xs);
    font-weight: var(--brand-label-weight);
    letter-spacing: 0.13em;
    text-transform: lowercase;
  }
  .service-card p {
    margin: auto 0 var(--space-1);
    font-size: var(--text-base);
    font-weight: 650;
  }
  .service-description {
    margin: var(--space-2) 0 var(--space-3);
    font-size: var(--text-xs);
    font-weight: 620;
  }
  .service-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .service-meta-row span {
    color: #7f8a7b;
    font-size: var(--text-xs);
    font-weight: 650;
  }
  .empty-service {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-3);
    padding: var(--space-6);
    border: 1px solid rgba(217, 210, 196, 0.95);
    border-radius: 8px;
    background: rgba(255, 250, 241, 0.72);
  }
  .empty-service p {
    margin: 0;
    color: rgba(34, 33, 29, 0.64);
  }
  .empty-service a {
    width: fit-content;
  }
  .quick-flow-board {
    padding: clamp(18px, 3vw, 26px);
  }
  .flow-head {
    margin-bottom: var(--space-4);
  }
  .quick-flow-steps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid rgba(217, 210, 196, 0.95);
    border-radius: 8px;
    overflow: hidden;
    background: rgba(255, 250, 241, 0.72);
  }
  .quick-flow-steps li {
    min-height: 124px;
    display: grid;
    align-content: start;
    gap: 5px;
    padding: 18px;
  }
  .quick-flow-steps li + li {
    border-left: 1px solid rgba(217, 210, 196, 0.95);
  }
  .quick-flow-steps b {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: rgba(168, 176, 162, 0.38);
    color: rgba(34, 33, 29, 0.74);
    font-size: var(--text-xs);
    font-weight: 650;
  }
  .quick-flow-steps strong {
    font-size: var(--text-sm);
    font-weight: 650;
  }
  .quick-flow-steps span {
    color: rgba(34, 33, 29, 0.62);
    font-size: var(--text-sm);
    line-height: 1.55;
  }
  .faq-section {
    padding: clamp(18px, 3vw, 26px);
  }
  .faq-list {
    display: grid;
    border: 1px solid rgba(217, 210, 196, 0.95);
    border-radius: 8px;
    overflow: hidden;
    background: rgba(255, 250, 241, 0.74);
  }
  .faq-list details + details {
    border-top: 1px solid rgba(217, 210, 196, 0.95);
  }
  .faq-list summary {
    min-height: 58px;
    display: flex;
    align-items: center;
    padding: 0 18px;
    color: var(--charcoal);
    font-size: var(--text-sm);
    font-weight: 700;
    cursor: pointer;
  }
  .faq-list p {
    margin: 0;
    padding: 0 18px 18px;
    color: rgba(34, 33, 29, 0.64);
    font-size: var(--text-sm);
    line-height: 1.65;
  }
  .bottom-cta {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    display: none;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
    padding: 10px 12px;
    border-top: 1px solid var(--warm-gray);
    background: rgba(247, 241, 230, 0.9);
    backdrop-filter: blur(12px);
  }
  .bottom-cta a {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    text-decoration: none;
    font-weight: 680;
  }
  .bottom-cta a:first-child {
    border: 1px solid var(--charcoal);
    background: var(--charcoal);
    color: var(--cream);
  }
  .bottom-cta a:last-child {
    border: 1px solid var(--warm-gray);
    background: transparent;
    color: var(--charcoal);
  }
  @media (max-width: 860px) {
    .home-hero {
      grid-template-columns: 1fr;
      gap: var(--space-6);
    }
    .hero-copy {
      min-height: 0;
    }
    .hero-visual {
      min-height: 320px;
    }
    .service-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .trust-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .quick-flow-steps {
      grid-template-columns: 1fr;
    }
    .quick-flow-steps li {
      min-height: auto;
    }
    .quick-flow-steps li + li {
      border-left: 0;
      border-top: 1px solid rgba(217, 210, 196, 0.95);
    }
  }
  @media (max-width: 640px) {
    .home-page {
      padding-inline: var(--space-3);
      overflow-x: hidden;
    }
    .home-hero {
      padding-block: var(--space-8);
    }
    .home-hero h1 {
      max-width: 12ch;
      font-size: clamp(2.5rem, 13vw, 3.25rem);
    }
    .hero-visual {
      display: none;
    }
    .quick-picks {
      display: none;
    }
    .hero-actions {
      display: grid;
    }
    .hero-actions a {
      width: 100%;
    }
    .hero-actions .kakao-action {
      display: none;
    }
    .service-grid {
      grid-template-columns: 1fr;
    }
    .trust-strip {
      grid-template-columns: 1fr;
    }
    .trust-strip article {
      min-height: 0;
    }
    .service-card {
      min-height: 0;
    }
    .bottom-cta {
      display: grid;
    }
    .home-page ~ .global-footer {
      padding-bottom: 76px;
    }
  }
`;
