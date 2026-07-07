import Link from "next/link";
import { BUILDUSCARE_CATEGORIES } from "@/lib/builduscare-public-routes";
import { BUILDUSCARE_LINEUP_IMAGES } from "@/lib/builduscare-lineup-assets";
import { getAllCases, getCoverImage, formatWon } from "@/lib/cases-data";

// 지역 문자열에서 "시 구"만 짧게 (예: "경기 성남시 분당구 판교원마을 힐스테이트" → "성남시 분당구")
function shortRegion(region: string): string {
  const tokens = region.replace(/^경기\s*/, "").split(/\s+/);
  const si = tokens.find((t) => t.endsWith("시")) ?? tokens[0] ?? "";
  const gu = tokens.find((t) => t.endsWith("구"));
  return gu ? `${si} ${gu}` : si;
}

const whyItems = [
  {
    id: "small",
    eyebrow: "작은 교체부터",
    title: <>집 전체보다,<br />낡은 것부터.</>,
    text: <>수전·변기·환풍기처럼<br />눈에 먼저 보이는 제품부터 정리합니다.</>,
    image: "/assets/whycard-faucet.png"
  },
  {
    id: "cost",
    eyebrow: "정직한 비용",
    title: <>추가비 견적비 출장비<br />0원.</>,
    text: <>예상 밖 작업은 먼저 설명합니다.<br />고객 동의 없이 진행하지 않습니다.</>,
    image: "/assets/whycard-receipt.png"
  },
  {
    id: "standard",
    eyebrow: "표준가",
    title: <>제품값도 설치비도,<br />표준가로.</>,
    text: <>제품 가격과 설치비를 나눠 보여드립니다.<br />비교하기 쉽게, 결정하기 쉽게.</>,
    image: "/assets/whycard-bag-orig.png"
  },
  {
    id: "visit",
    eyebrow: "방문견적 없음",
    title: <>견적 때문에<br />시간 비우지 마세요.</>,
    text: <>방문견적은 없습니다.<br />방문은 교체가 필요할 때만 진행합니다.</>,
    image: "/assets/whycard-schedule.png"
  }
];

const categoryTags: Record<string, string> = {
  toilet: "인기",
  faucet: "인기",
  "bath-accessory": "신규"
};

const categoryDescriptions: Record<string, string> = {
  toilet: "오래된 변기, 흔들림과 물샘까지.",
  washbasin: "낡은 세면대, 하부 배관까지 깔끔하게.",
  faucet: "물샘·노후 수전을 새 디자인으로.",
  bidet: "기존 변기에 비데를 더하다.",
  ventilation: "소음과 약해진 흡입력을 개선.",
  "window-handle": "헐거운 창호 손잡이를 새것으로.",
  "door-handle": "현관·방문 손잡이를 새것처럼.",
  silicone: "곰팡이·들뜬 마감을 깔끔하게.",
  "bath-accessory": "수건걸이·선반·휴지걸이를 한 번에."
};

function photoCheckHref(itemLabel: string) {
  return `/photo-check?item=${encodeURIComponent(itemLabel)}`;
}

function KakaoIcon() {
  return (
    <svg className="kkic" viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18, flex: "none" }} aria-hidden="true">
      <path d="M12 3.4C6.7 3.4 2.4 6.85 2.4 11.1c0 2.74 1.82 5.14 4.55 6.52-.2.72-.72 2.62-.83 3.03-.14.5.18.5.39.37.16-.1 2.5-1.7 3.52-2.4.51.07 1.03.11 1.57.11 5.3 0 9.6-3.45 9.6-7.63S17.3 3.4 12 3.4z" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

const heroLabelText = "투명하고 숨김 없는 견적 · 추가금 없이 끝까지 그대로";

const heroAreaCities = "수원, 용인, 동탄, 군포, 의왕, 성남(분당구), 안양(동안구)";

// 히어로 우측 카드에 3×3으로 들어가는 제품 아이콘 (교체 품목 9종)
const heroIcons = [
  { slug: "toilet", label: "양변기" },
  { slug: "washbasin", label: "세면대" },
  { slug: "faucet", label: "수전" },
  { slug: "bidet", label: "비데" },
  { slug: "ventilation", label: "환풍기" },
  { slug: "window-handle", label: "창호 손잡이" },
  { slug: "door-handle", label: "도어 손잡이" },
  { slug: "silicone", label: "실리콘" },
  { slug: "bath-accessory", label: "욕실 액세서리" }
];

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

const heroCss = `
.hero2 { display: grid; grid-template-columns: 55% 45%; gap: clamp(24px, 4vw, 48px); align-items: stretch; padding: clamp(36px, 5vw, 64px) 0 clamp(28px, 4vw, 44px); }
.hero2-left { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; max-width: 640px; }
.hero2-label { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: var(--color-primary); background: var(--color-primary-highlight); padding: 8px 14px; border-radius: 999px; line-height: 1.3; }
.hero2-label svg { width: 15px; height: 15px; flex: none; }
.hero2-title { margin: 0; font-size: clamp(30px, 3.6vw, 46px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.16; color: var(--color-text); }
.hero2-subline { margin: 0; font-size: 17px; font-weight: 700; line-height: 1.4; letter-spacing: -0.01em; color: var(--color-text); }
.hero2-desc { margin: 0; font-size: clamp(15px, 1.35vw, 18px); line-height: 1.6; color: var(--color-text-muted); }
.hero2-cta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
.hero2-area { display: flex; align-items: flex-start; gap: 6px; margin: 2px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--color-text-faint); }
.hero2-area svg { width: 14px; height: 14px; flex: none; margin-top: 1px; }
.hero2-area b { font-weight: 700; color: var(--color-text-muted); }
.hero2-area .exp { color: var(--color-text-faint); }
.hero2-right { min-width: 0; display: flex; min-height: 0; }
/* '하면 쉬운 이유' 카드와 동일한 톤: 흰 배경 + 둥근 모서리 + 부드러운 그림자. 왼쪽 텍스트 높이에 맞춰 늘어남 */
.hero2-iconcard { flex: 1; display: flex; flex-direction: column; min-height: 0; background: #fff; border-radius: 18px; box-shadow: var(--bc-soft); padding: clamp(16px, 2.2vw, 26px); }
.hero2-icongrid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); gap: clamp(8px, 1.4vw, 16px); }
.hero2-icon { min-height: 0; display: grid; place-items: center; }
.hero2-icon img { width: auto; height: auto; max-width: 74%; max-height: 74%; object-fit: contain; display: block; }
@media (max-width: 900px) { .hero2 { grid-template-columns: 1fr; } .hero2-right { margin-top: 4px; } }
.hero2m { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; padding: 24px 20px 10px; }
.hero2m .hero2-label { align-self: flex-start; }
.hero2m-title { margin: 0; font-size: clamp(24px, 7vw, 30px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.2; color: var(--color-text); }
.hero2m-subline { margin: 0; font-size: 14.5px; font-weight: 700; line-height: 1.4; letter-spacing: -0.01em; color: var(--color-text); }
.hero2m-desc { margin: 0; font-size: 15px; line-height: 1.55; color: var(--color-text-muted); }
/* 모바일 버튼은 웹과 동일한 .hero2-cta / .web-btn 재사용 (알약 모양, 내용 크기) — 모바일에선 더 작게 */
.hero2m .hero2-cta { margin-top: 6px; gap: 8px; }
.hero2m .web-btn { padding: 7px 15px !important; font-size: 13px !important; font-weight: 600 !important; }
.hero2m .web-btn svg { width: 15px !important; height: 15px !important; }
/* 모바일 전용 — 품목 아이콘 가로 스크롤 줄 */
.hero-iconstrip { display: flex; gap: 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; padding: 6px 20px 16px; margin: 0; scrollbar-width: none; }
.hero-iconstrip::-webkit-scrollbar { display: none; }
.hero-iconstrip-item { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 56px; text-decoration: none; color: var(--color-text); }
.hero-iconstrip-im { width: 58px; height: 58px; display: grid; place-items: center; background: var(--color-surface-2); border-radius: 16px; }
.hero-iconstrip-im img { width: 72%; height: 72%; object-fit: contain; display: block; }
.hero-iconstrip-nm { font-size: 11.5px; font-weight: 600; color: var(--color-text-muted); white-space: nowrap; letter-spacing: -0.02em; }

/* 교체사례 미리보기 (안 A · '하면 쉬운 이유' 카드 디자인 — 각 사례가 개별 카드) */
.ctz-sec { padding: 8px 0 4px; }
.ctz-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 10px; }
/* '바꿀 수 있는 9가지' 섹션 제목(.eyebrow / .web-h2)과 폰트·크기·굵기 동일하게 */
.ctz-eyebrow { font-size: 12px; font-weight: 600; letter-spacing: 0.02em; color: var(--brand-700); margin-bottom: 6px; }
.ctz-title { font-size: 34px; font-weight: 600; letter-spacing: -0.022em; line-height: 1.1; margin: 0; }
.ctz-more { flex: none; font-size: 15px; font-weight: 600; color: var(--color-text-muted); text-decoration: none; white-space: nowrap; }
/* 상하 여백을 줘서 hover로 살짝 떠도 잘리지 않게 */
.ctz-scroll { display: flex; gap: 16px; overflow-x: auto; padding: 10px 4px 26px; scrollbar-width: none; }
.ctz-scroll::-webkit-scrollbar { display: none; }
.ctz-card { flex: 0 0 auto; width: 230px; background: #fff; border-radius: 18px; box-shadow: var(--bc-soft); overflow: hidden; text-decoration: none; color: var(--color-text); transition: transform .2s ease, box-shadow .2s ease; }
/* hover 효과는 마우스가 있는 기기(웹)에서만 */
@media (hover: hover) {
  .ctz-card:hover { transform: translateY(-4px); box-shadow: 0 16px 36px -18px rgba(16,24,40,.28); }
}
.ctz-im { display: block; aspect-ratio: 4 / 3; background: var(--color-surface-2); overflow: hidden; }
.ctz-im img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ctz-body { display: block; padding: 13px 15px 15px; }
.ctz-cat { display: inline-block; font-size: 12px; font-weight: 700; color: var(--color-primary); background: var(--color-primary-highlight); padding: 4px 10px; border-radius: 999px; }
.ctz-rg { display: block; font-size: 13.5px; color: var(--color-text-muted); margin-top: 9px; }
.ctz-pr { display: block; font-size: 17px; font-weight: 800; margin-top: 3px; }
.home-mobile .ctz-sec { padding: 6px 0 4px; }
.home-mobile .ctz-head { padding: 0 20px; margin-bottom: 12px; }
.home-mobile .ctz-scroll { padding: 4px 20px 16px; gap: 12px; }
.home-mobile .ctz-title { font-size: 25px; letter-spacing: -0.018em; line-height: 1.32; }
.home-mobile .ctz-more { font-size: 13px; }
/* 모바일: 커지는 애니메이션 제거 */
.home-mobile .ctz-card { width: 200px; transition: none; transform: none !important; }
`;

export function HomeLanding() {
  const teaserCases = getAllCases().slice(0, 8);
  const casesTeaser = (
    <section className="ctz ctz-sec" aria-label="교체 사례">
      <div className="ctz-head">
        <div>
          <div className="ctz-eyebrow">교체사례</div>
          <h2 className="ctz-title">교체 사례를 보고<br />우리집과 비교해 보세요</h2>
        </div>
        <Link className="ctz-more" href="/cases">전체 보기 ›</Link>
      </div>
      <div className="ctz-scroll">
        {teaserCases.map((c) => (
          <Link key={c.slug} className="ctz-card" href={`/cases/${c.slug}`}>
            <span className="ctz-im">
              <img src={getCoverImage(c) ?? ""} alt="" loading="lazy" decoding="async" />
            </span>
            <span className="ctz-body">
              <span className="ctz-cat">{c.category}</span>
              <span className="ctz-rg">{shortRegion(c.region)}</span>
              <span className="ctz-pr">{formatWon(c.costTotal)}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
  return (
    <main className="bc-page">
      <style dangerouslySetInnerHTML={{ __html: heroCss }} />
      <div className="home-mobile bc-mobile-only">
        <section className="hero2m" aria-label="Build us Care 소개">
          <span className="hero2-label"><ShieldCheckIcon /> {heroLabelText}</span>
          <h1 className="hero2m-title">집 전체 공사 말고,<br />낡아 보이는 것부터 교체하세요.</h1>
          <p className="hero2m-subline">세면대, 양변기, 환풍기, 수전, 문손잡이 등<br />쉽고 빠르게 교체하세요.</p>
          <p className="hero2m-desc">사진으로 교체 가능 여부를 먼저 확인하고,<br />제품값과 시공비를 나눠 보고 예약할 수 있어요.</p>
          <div className="hero2-cta">
            <Link className="web-btn pri" href="/photo-check">사진으로 확인하기</Link>
            <Link className="web-btn outline" href="/products">바로 견적확인하기</Link>
            <a className="web-btn kkbtn" href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer">
              <KakaoIcon /> 카카오로 문의하기
            </a>
          </div>
          <p className="hero2-area">
            <PinIcon />
            <span><b>서비스 가능지역</b> {heroAreaCities} <span className="exp">· 추후 확장 예정</span></span>
          </p>
        </section>

        <nav className="hero-iconstrip" aria-label="교체 품목 바로가기">
          {heroIcons.map((it) => (
            <Link key={it.slug} className="hero-iconstrip-item" href={`/products/${it.slug}`}>
              <span className="hero-iconstrip-im">
                <img src={`/assets/hero-icons/${it.slug}.png`} alt="" loading="lazy" decoding="async" />
              </span>
              <span className="hero-iconstrip-nm">{it.label}</span>
            </Link>
          ))}
        </nav>

        <section className="home-mobile-section">
          <div className="h-md" style={{ fontSize: 25 }}>Build us Care에서<br />하면 쉬운 이유.</div>
          <p className="p-sm" style={{ color: "var(--gray-500)", marginTop: 3 }}>집 전체를 고치기 전에, 먼저 바꿀 수 있는 것부터 봅니다.</p>
          <div className="mwhy-grid mt14">
            {whyItems.map((item) => (
              <article key={item.id} className="bcard pad mwhy">
                <div className="mwhy-eye">{item.eyebrow}</div>
                <div className="h-sm mt6">{item.title}</div>
                <p className="p-sm mt8" style={{ color: "var(--gray-600)" }}>{item.text}</p>
                <div className="mwhy-media">
                  <img src={item.image} alt="" loading="lazy" decoding="async" />
                </div>
              </article>
            ))}
          </div>
        </section>

        {casesTeaser}

        <section className="lineup-band-m" aria-label="교체 가능 품목">
          <div className="h-md" style={{ fontSize: 25 }}>지금 바로<br />바꿀 수 있는 9가지</div>
          <p className="p-sm" style={{ color: "var(--gray-500)", marginTop: 3 }}>한 번에 여러 가지를 교체할 수 있습니다.</p>
          <div className="home-lineup mt12">
            {BUILDUSCARE_CATEGORIES.map((category) => (
              <article key={category.slug} className="ml">
                <Link className="ml-media" href={`/products/${category.slug}`}>
                  <img className="ml-img" src={BUILDUSCARE_LINEUP_IMAGES[category.slug] ?? category.image} alt={category.title} loading="lazy" decoding="async" />
                </Link>
                <div className="ml-tag">{categoryTags[category.slug] ?? ""}</div>
                <div className="ml-name">{category.title} <span className="enlabel">{category.english}</span></div>
                <p className="ml-desc">{categoryDescriptions[category.slug] ?? category.description}</p>
                <div className="ml-meta">사진 확인부터</div>
                <div className="ml-cta">
                  <Link className="btn btn-primary btn-sm" href={`/products/${category.slug}`}>둘러보기</Link>
                  <Link className="ml-link" href={photoCheckHref(category.itemLabel)}>사진 확인 ›</Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="wrap home-wrap home-desktop bc-desktop-only">
        <section className="hero2" aria-label="Build us Care 소개">
          <div className="hero2-left">
            <span className="hero2-label"><ShieldCheckIcon /> {heroLabelText}</span>
            <h1 className="hero2-title">집 전체 공사 말고,<br />낡아 보이는 것부터 교체하세요.</h1>
            <p className="hero2-subline">세면대, 양변기, 환풍기, 수전, 문손잡이 등<br />쉽고 빠르게 교체하세요.</p>
            <p className="hero2-desc">사진으로 교체 가능 여부를 먼저 확인하고,<br />제품값과 시공비를 나눠 보고 예약할 수 있어요.</p>
            <div className="hero2-cta">
              <Link className="web-btn pri" href="/photo-check">사진으로 확인하기</Link>
              <Link className="web-btn outline" href="/products">바로 견적확인하기</Link>
              <a className="web-btn kkbtn" href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer">
                <KakaoIcon /> 카카오로 문의하기
              </a>
            </div>
            <p className="hero2-area">
              <PinIcon />
              <span><b>서비스 가능지역</b> {heroAreaCities} <span className="exp">· 추후 확장 예정</span></span>
            </p>
          </div>
          <div className="hero2-right" aria-hidden="true">
            <div className="hero2-iconcard">
              <div className="hero2-icongrid">
                {heroIcons.map((it) => (
                  <span key={it.slug} className="hero2-icon">
                    <img src={`/assets/hero-icons/${it.slug}.png`} alt="" loading="lazy" decoding="async" />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="why-sec">
          <div className="why-head">
            <div className="web-h2" style={{ fontSize: 34 }}>Build us Care에서<br />하면 쉬운 이유.</div>
            <Link className="why-link" href="/products">바꿀 수 있는 제품 보기 ›</Link>
          </div>
          <div className="why-grid">
            {whyItems.map((item) => (
              <article key={item.id} className="bcwhy">
                <div className="bcwhy-eye">{item.eyebrow}</div>
                <div className="bcwhy-t">{item.title}</div>
                <p className="bcwhy-d">{item.text}</p>
                <div className="bcwhy-media">
                  <img src={item.image} alt="" loading="lazy" decoding="async" />
                </div>
              </article>
            ))}
          </div>
        </section>

        {casesTeaser}

        <section className="lineup-band" aria-label="교체 가능 품목">
          <div className="between" style={{ marginTop: 0 }}>
            <div>
              <div className="eyebrow">사진으로 먼저 확인</div>
              <div className="web-h2" style={{ marginTop: 6, fontSize: 34 }}>바꿀 수 있는 9가지.</div>
            </div>
          </div>
          <div className="lineup" style={{ marginTop: 22 }}>
            {BUILDUSCARE_CATEGORIES.map((category) => (
              <article key={category.slug} className="lc">
                <Link className="lc-media" href={`/products/${category.slug}`}>
                  <img src={BUILDUSCARE_LINEUP_IMAGES[category.slug] ?? category.image} alt="" loading="lazy" decoding="async" />
                </Link>
                <div className="lc-tag">{categoryTags[category.slug] ?? ""}</div>
                <div className="lc-name">{category.title} <span className="enlabel">{category.english}</span></div>
                <p className="lc-desc">{categoryDescriptions[category.slug] ?? category.description}</p>
                <div className="lc-cta">
                  <Link className="web-btn pri" href={`/products/${category.slug}`}>둘러보기</Link>
                  <Link className="lc-link" href={photoCheckHref(category.itemLabel)}>사진 확인 ›</Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
