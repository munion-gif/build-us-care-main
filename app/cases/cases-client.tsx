"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin, Star } from "lucide-react";
import { EVENT_TYPES } from "@/lib/event-types";
import { formatKRDate, formatKRW } from "@/lib/format";
import { appendSourceParams, readClientSourceContext } from "@/lib/traffic-source";
import { useTracking } from "@/lib/use-tracking";

type CaseItem = {
  id: string;
  job_id: string | null;
  service_code: string;
  service_name: string;
  category: string;
  completed_at: string | null;
  image_url: string | null;
  before_image_url: string | null;
  rating: number | null;
  total_price: number | null;
  labor_price: number | null;
  material_price: number | null;
  visit_fee: number | null;
  price_note: string;
  summary: string;
  problem: string;
  work: string;
  region: string;
  building_type: string;
  tags: string[];
  quote_href: string;
  photo_href: string;
};

type Facets = {
  services: Array<{ code: string; name: string }>;
  regions: string[];
};

const TABS = [
  { key: "all", label: "전체" },
  { key: "toilet_replace", label: "변기" },
  { key: "faucet_replace", label: "수전" },
  { key: "light_replace", label: "전등" },
  { key: "outlet_replace", label: "콘센트" },
  { key: "door_handle", label: "도어핸들" },
  { key: "bidet_install", label: "비데" },
  { key: "ventilator_replace", label: "환풍기" }
] as const;

const TAB_LABEL_BY_SERVICE: Record<string, string> = {
  toilet_replace: "변기",
  faucet_replace: "수전",
  kitchen_faucet: "수전",
  light_replace: "전등",
  outlet_replace: "콘센트",
  door_handle: "도어핸들",
  bidet_install: "비데",
  ventilator_replace: "환풍기",
  bath_fan: "환풍기"
};

const BUILDING_LABELS: Record<string, string> = {
  apartment: "아파트",
  villa: "빌라",
  house: "단독주택",
  officetel: "오피스텔",
  commercial: "상가",
  unknown: "주거형태 확인"
};

export function CasesClient() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [region, setRegion] = useState("all");
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [facets, setFacets] = useState<Facets>({ services: [], regions: [] });
  const [sourceContext, setSourceContext] = useState(() => readClientSourceContext());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { track } = useTracking();

  useEffect(() => {
    setSourceContext(readClientSourceContext());
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCases() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ service: activeTab, region, limit: "30" });
        const response = await fetch(`/api/cases?${params.toString()}`, {
          signal: controller.signal
        });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(payload.message ?? "시공 사례를 불러오지 못했어요.");
        }

        const nextCases = payload.data?.cases ?? [];
        setCases(nextCases);
        setFacets(payload.data?.facets ?? { services: [], regions: [] });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
          setCases([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadCases();
    return () => controller.abort();
  }, [activeTab, region]);

  const countLabel = useMemo(() => {
    if (loading) return "불러오는 중";
    return `${cases.length.toLocaleString("ko-KR")}건`;
  }, [cases.length, loading]);
  const selectedCaseType = TABS.find((tab) => tab.key === activeTab)?.label ?? "선택한 품목";
  const emptyTitle = activeTab === "all"
    ? "조건에 맞는 사례가 아직 없습니다."
    : `${selectedCaseType} 사례가 아직 없습니다.`;
  const isInstagram = sourceContext.isInstagram;
  const heroPhotoHref = appendSourceParams("/request/photo", sourceContext);

  return (
    <main className="cases-page">
      <style>{css}</style>
      <section className="cases-hero">
        <strong className="brand-kicker">build us care</strong>
        <span>{isInstagram ? "Instagram 유입 고객 안내" : "시공 사례"}</span>
        <h1>{isInstagram ? "비슷한 사례를 보고, 우리 집도 사진으로 먼저 확인하세요" : "우리 집과 비슷한 교체 사례를 먼저 확인하세요"}</h1>
        <p>{isInstagram ? "사진만 먼저 보내도 교체추천 · 보류 · 교체불필요를 확인할 수 있고, 필요한 경우 견적과 방문 예약으로 이어집니다." : "비슷한 집의 문제 상태와 교체 과정을 보고, 내 상황과 비교해보세요."}</p>
      </section>

      <section className="cases-toolbar" aria-label="시공 사례 탐색">
        <div className="case-toolbar-main">
          <div className="case-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={activeTab === tab.key ? "active" : ""}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="case-selects">
            <select value={region} onChange={(event) => setRegion(event.target.value)} aria-label="지역 필터">
              <option value="all">전체 지역</option>
              {facets.regions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="case-empty">
          <div className="case-skeleton" />
          <p>시공 사례를 불러오고 있어요.</p>
        </section>
      ) : error ? (
        <section className="case-empty">
          <h2>사례를 불러오지 못했어요</h2>
          <p>{error}</p>
          <button type="button" onClick={() => { setActiveTab("all"); setRegion("all"); }}>
            다시 확인하기
          </button>
        </section>
      ) : cases.length === 0 ? (
        <section className="case-empty">
          <h2>{emptyTitle}</h2>
          <p>아직 등록된 실제 시공 사진이 없어요. 사진을 보내주시면 교체 가능 여부를 먼저 확인해드릴게요.</p>
          <a href={heroPhotoHref}>사진 제품 호환 확인</a>
        </section>
      ) : (
        <section className="case-layout">
          <div className="case-grid" aria-label="시공 사례 목록">
            {cases.map((item) => {
              const hasPrice = Boolean(item.total_price || item.labor_price);
              return (
                <article className="case-card" key={item.id}>
                  <div className="case-photo" aria-label={`${item.service_name} 시공 사진`}>
                    {item.image_url ? (
                      <img src={item.image_url} alt={`${item.service_name} 완료 사진`} />
                    ) : item.before_image_url ? (
                      <img src={item.before_image_url} alt={`${item.service_name} 시공 전 사진`} />
                    ) : (
                      <span>사진 준비 중</span>
                    )}
                    <div className="case-photo-badges">
                      <span>{item.region}</span>
                      <span>{item.service_name}</span>
                    </div>
                    {item.before_image_url && item.image_url && (
                      <figure className="case-before-thumb">
                        <img src={item.before_image_url} alt={`${item.service_name} 시공 전 사진`} />
                        <figcaption>Before</figcaption>
                      </figure>
                    )}
                  </div>
                  <div className="case-body">
                    <div className="case-card-head">
                      <span className="case-chip">{TAB_LABEL_BY_SERVICE[item.service_code] ?? item.service_name}</span>
                      {item.rating ? <span className="case-rating"><Star size={14} fill="currentColor" />{item.rating.toFixed(1)}</span> : null}
                    </div>
                    <h2>{item.service_name}</h2>
                    {hasPrice ? (
                      <div className="case-price-proof">
                        <div>
                          <strong>{formatKRW(item.total_price ?? item.labor_price)}</strong>
                          <span>{item.price_note}</span>
                        </div>
                        <dl>
                          {item.labor_price ? (
                            <div>
                              <dt>공임</dt>
                              <dd>{formatKRW(item.labor_price)}</dd>
                            </div>
                          ) : null}
                          {item.material_price ? (
                            <div>
                              <dt>제품/자재</dt>
                              <dd>{formatKRW(item.material_price)}</dd>
                            </div>
                          ) : null}
                          {item.visit_fee ? (
                            <div>
                              <dt>방문비</dt>
                              <dd>{formatKRW(item.visit_fee)}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                    ) : null}
                    <p className="case-summary">{item.summary}</p>
                    <p className="case-proof-line">
                      <b>{item.problem}</b>
                      <span>{item.work}</span>
                    </p>
                    <div className="case-tags">
                      {item.tags.slice(0, 3).map((tag) => <span key={tag}>{BUILDING_LABELS[tag] ?? tag}</span>)}
                    </div>
                    <div className="case-meta">
                      <span><MapPin size={15} />{item.region}</span>
                      <span><CalendarDays size={15} />{formatKRDate(item.completed_at)}</span>
                    </div>
                  </div>
                  <div className="case-card-actions">
                    <a
                      href={appendSourceParams(item.quote_href, sourceContext)}
                      onClick={() => void track(EVENT_TYPES.CASES_CTA_CLICK, { target: "quote", case_id: item.id, source: sourceContext.trafficSource })}
                    >
                      이 서비스 견적 보기
                    </a>
                    <a
                      href={appendSourceParams(item.photo_href, sourceContext)}
                      onClick={() => void track(EVENT_TYPES.CASES_CTA_CLICK, { target: "photo", case_id: item.id, source: sourceContext.trafficSource })}
                    >
                      사진 제품 호환 확인
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

const css = `
  .cases-page { min-height: 100vh; background: var(--color-bg); padding: clamp(2.5rem, 5vw, 4rem) var(--space-4) var(--space-16); }
  .cases-page > section { width: min(var(--content-wide), 100%); margin-inline: auto; }
  .cases-hero { margin-bottom: var(--space-5); border: 1px solid var(--color-border); border-radius: 8px; padding: clamp(22px, 4vw, 34px); background: linear-gradient(135deg, rgba(255, 250, 241, 0.96), rgba(228, 232, 223, 0.82)); box-shadow: 0 12px 30px rgba(34, 33, 29, 0.045); }
  .brand-kicker { display: block; margin-bottom: 18px; color: var(--color-text); font-family: var(--font-brand); font-size: 13px; font-weight: var(--brand-label-weight); letter-spacing: var(--brand-letter-spacing); text-transform: lowercase; }
  .cases-hero span { color: var(--color-primary); font-size: var(--text-sm); font-weight: 800; }
  .cases-hero h1 { max-width: 760px; margin: var(--space-2) 0; color: var(--color-text); font-size: var(--text-xl); font-weight: 700; letter-spacing: 0; line-height: 1.2; }
  .cases-hero p { max-width: 620px; margin-bottom: 0; color: var(--color-text-muted); font-size: var(--text-base); line-height: 1.7; }
  .case-card-actions a, .case-empty a, .case-empty button { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 0; border-radius: var(--radius-full); padding: 0 var(--space-5); background: var(--color-gold); color: #211c12; font-weight: 900; text-decoration: none; cursor: pointer; }
  .cases-toolbar { display: block; margin-bottom: var(--space-5); border-bottom: 1px solid var(--color-border); padding: 0 0 var(--space-4); }
  .case-toolbar-main { display: grid; gap: var(--space-2); min-width: 0; }
  .case-tabs { display: flex; gap: var(--space-2); overflow-x: auto; padding-bottom: 2px; }
  .case-tabs button { min-height: 36px; border: 1px solid var(--color-border); border-radius: var(--radius-full); padding: 0 var(--space-4); background: var(--color-surface); color: var(--color-text-muted); font-size: var(--text-sm); font-weight: 800; white-space: nowrap; cursor: pointer; }
  .case-tabs button.active { background: var(--color-charcoal-panel); color: var(--color-cream); }
  .case-selects { display: flex; gap: var(--space-2); }
  .case-selects select { min-height: 38px; border: 1px solid var(--color-border); border-radius: var(--radius-full); padding: 0 var(--space-4); background: var(--color-surface); color: var(--color-text); font-size: var(--text-sm); font-weight: 800; }
  .case-layout { display: block; }
  .case-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
  .case-card { overflow: hidden; display: grid; border: 1px solid var(--color-border); border-radius: 18px; background: var(--color-surface); box-shadow: var(--shadow-sm); transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition); }
  .case-card:hover { border-color: rgba(184, 138, 43, 0.42); transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .case-photo { position: relative; aspect-ratio: 16 / 10; overflow: hidden; background: var(--color-surface-2); }
  .case-photo > img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .case-photo > span { position: absolute; inset: 0; display: grid; place-items: center; color: var(--color-text-muted); font-size: var(--text-sm); font-weight: 900; }
  .case-photo-badges { position: absolute; left: 12px; top: 12px; display: flex; flex-wrap: wrap; gap: 6px; }
  .case-photo-badges span { min-height: 28px; display: inline-flex; align-items: center; border-radius: var(--radius-full); padding: 0 10px; background: rgba(0, 0, 0, 0.62); color: #fff; font-size: var(--text-xs); font-weight: 900; backdrop-filter: blur(8px); }
  .case-before-thumb { position: absolute; right: 12px; bottom: 12px; width: min(132px, 32%); aspect-ratio: 4 / 3; overflow: hidden; margin: 0; border: 2px solid rgba(255,255,255,0.9); border-radius: var(--radius-sm); background: var(--color-surface); box-shadow: var(--shadow-md); }
  .case-before-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .case-before-thumb figcaption { position: absolute; left: 6px; bottom: 6px; border-radius: var(--radius-full); padding: 2px 6px; background: rgba(0,0,0,0.68); color: #fff; font-size: 0.68rem; font-weight: 900; }
  .case-body { padding: var(--space-4); }
  .case-card-head { display: flex; justify-content: space-between; gap: var(--space-2); align-items: center; }
  .case-chip { display: inline-flex; align-items: center; min-height: 26px; border-radius: var(--radius-full); padding: 0 var(--space-3); background: var(--color-primary-highlight); color: var(--color-text); font-size: var(--text-xs); font-weight: 800; }
  .case-rating { display: inline-flex; align-items: center; gap: 4px; color: var(--color-accent-orange); font-size: var(--text-xs); font-weight: 900; }
  .case-body h2 { margin: var(--space-3) 0 var(--space-2); color: var(--color-text); font-size: var(--text-base); font-weight: 700; letter-spacing: 0; }
  .case-price-proof { display: grid; gap: var(--space-2); margin: 0 0 var(--space-3); border: 1px solid rgba(184, 138, 43, 0.2); border-radius: 8px; background: rgba(244, 234, 212, 0.5); padding: var(--space-3); }
  .case-price-proof > div:first-child { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
  .case-price-proof strong { color: var(--color-text); font-size: clamp(1.1rem, 1.6vw, 1.35rem); font-weight: 800; letter-spacing: 0; }
  .case-price-proof span { color: var(--color-text-muted); font-size: var(--text-xs); font-weight: 800; white-space: nowrap; }
  .case-price-proof dl { display: flex; flex-wrap: wrap; gap: 6px 10px; margin: 0; color: var(--color-text-muted); font-size: var(--text-xs); }
  .case-price-proof dl div { display: inline-flex; gap: 4px; }
  .case-price-proof dt, .case-price-proof dd { margin: 0; }
  .case-price-proof dt { font-weight: 800; }
  .case-summary { margin: 0 0 var(--space-3); color: var(--color-text-muted); font-size: var(--text-sm); line-height: 1.55; }
  .case-proof-line { display: grid; gap: 6px; margin: 0 0 var(--space-3); border-radius: var(--radius-md); background: var(--color-surface-2); padding: var(--space-3); }
  .case-proof-line b { color: var(--color-text); font-size: var(--text-sm); line-height: 1.45; }
  .case-proof-line span { color: var(--color-text-muted); font-size: var(--text-sm); line-height: 1.45; }
  .case-tags, .case-meta { display: flex; flex-wrap: wrap; gap: 7px; color: var(--color-text-muted); font-size: var(--text-sm); }
  .case-tags { margin-bottom: var(--space-3); }
  .case-tags span { border-radius: var(--radius-full); padding: 3px 8px; background: var(--color-surface-2); font-size: var(--text-xs); font-weight: 800; }
  .case-meta span { display: inline-flex; align-items: center; gap: var(--space-1); }
  .case-card-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; border-top: 1px solid var(--color-border); background: var(--color-border); }
  .case-card-actions a { border-radius: 0; background: var(--color-surface); color: var(--color-text); font-size: var(--text-sm); }
  .case-card-actions a + a { color: var(--color-text); }
  .case-empty { display: grid; place-items: center; min-height: 360px; border: 1px dashed var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); padding: var(--space-8); text-align: center; }
  .case-empty h2 { margin: 0 0 var(--space-2); font-size: var(--text-lg); }
  .case-empty p { margin: 0; color: var(--color-text-muted); line-height: 1.7; }
  .case-empty a, .case-empty button { margin-top: var(--space-5); }
  .case-skeleton { width: min(280px, 80vw); aspect-ratio: 4 / 3; border-radius: var(--radius-md); background: linear-gradient(90deg, var(--color-surface-2), #fff, var(--color-surface-2)); background-size: 200% 100%; animation: casePulse 1.2s ease-in-out infinite; }
  @keyframes casePulse { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  @media (max-width: 980px) {
    .case-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 620px) {
    .cases-page { padding: 2.5rem 18px 4.75rem; }
    .cases-hero {
      margin-bottom: 1.4rem;
      padding: 1.75rem 1.35rem;
    }
    .cases-hero h1 {
      line-height: 1.3;
    }
    .cases-hero p {
      line-height: 1.7;
    }
    .cases-toolbar {
      display: grid;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
    }
    .case-grid, .case-selects { grid-template-columns: 1fr; display: grid; }
    .case-tabs {
      flex-wrap: wrap;
      overflow-x: visible;
      gap: 0.625rem;
    }
    .case-tabs button {
      flex: 1 1 calc(33.333% - 0.625rem);
      min-height: 40px;
      padding-inline: 0.875rem;
    }
    .case-selects select {
      min-height: 42px;
      border-radius: 8px;
    }
    .case-card {
      border-radius: 12px;
    }
    .case-body { padding: 1rem; }
    .case-card-actions { grid-template-columns: 1fr; }
  }
`;
