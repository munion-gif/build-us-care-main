import Link from "next/link";
import { BUILDUSCARE_CATEGORIES } from "@/lib/builduscare-public-routes";
import { BUILDUSCARE_LINEUP_IMAGES } from "@/lib/builduscare-lineup-assets";

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

const heroItems = [
  { slug: "faucet", label: "수전" },
  { slug: "toilet", label: "양변기" },
  { slug: "washbasin", label: "세면대" },
  { slug: "ventilation", label: "환풍기" }
];

const heroBadges = ["사진 확인 후 교체 가능", "제품값 먼저 확인", "시공비 별도 안내"];

const heroLabelText = "투명하고 숨김 없는 견적 · 추가금 없이 끝까지 그대로";

const heroCss = `
.hero2 { display: grid; grid-template-columns: 55% 45%; gap: clamp(24px, 4vw, 48px); align-items: center; padding: clamp(36px, 5vw, 64px) 0 clamp(28px, 4vw, 44px); }
.hero2-left { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; }
.hero2-label { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: var(--color-primary); background: var(--color-primary-highlight); padding: 8px 14px; border-radius: 999px; line-height: 1.3; }
.hero2-label svg { width: 15px; height: 15px; flex: none; }
.hero2-title { margin: 0; font-size: clamp(30px, 3.6vw, 46px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.16; color: var(--color-text); }
.hero2-desc { margin: 0; font-size: clamp(15px, 1.35vw, 18px); line-height: 1.6; color: var(--color-text-muted); }
.hero2-cta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
.hero2-right { min-width: 0; }
.hero2-visual { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: 24px; padding: 20px; }
.hero2-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.hero2-card { display: flex; flex-direction: column; gap: 8px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; padding: 12px; text-decoration: none; color: var(--color-text); transition: transform .15s ease, box-shadow .15s ease; }
.hero2-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px -14px rgba(16,24,40,.25); }
.hero2-card-im { aspect-ratio: 5 / 4; border-radius: 11px; background: #fff; border: 1px solid var(--color-border); display: grid; place-items: center; overflow: hidden; }
.hero2-card-im img { width: 78%; height: 78%; object-fit: contain; }
.hero2-card-nm { font-size: 14px; font-weight: 700; letter-spacing: -0.01em; }
.hero2-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.hero2-badge { font-size: 12.5px; font-weight: 600; color: var(--color-text-muted); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 999px; padding: 7px 12px; }
@media (max-width: 900px) { .hero2 { grid-template-columns: 1fr; } .hero2-right { margin-top: 6px; } }
.hero2m { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; padding: 22px 0 6px; }
.hero2m .hero2-label { align-self: flex-start; }
.hero2m-title { margin: 0; font-size: clamp(24px, 7vw, 30px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.2; color: var(--color-text); }
.hero2m-desc { margin: 0; font-size: 15px; line-height: 1.55; color: var(--color-text-muted); }
.hero2m .hl-cta { width: 100%; margin-top: 4px; }
.hero2m-badges { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 4px; }
`;

export function HomeLanding() {
  return (
    <main className="bc-page">
      <style dangerouslySetInnerHTML={{ __html: heroCss }} />
      <div className="home-mobile bc-mobile-only">
        <section className="hero2m" aria-label="Build us Care 소개">
          <span className="hero2-label"><ShieldCheckIcon /> {heroLabelText}</span>
          <h1 className="hero2m-title">집 전체 공사 말고,<br />낡아 보이는 것부터 교체하세요.</h1>
          <p className="hero2m-desc">사진으로 교체 가능 여부를 먼저 확인하고,<br />제품값과 시공비를 나눠 보고 예약할 수 있어요.</p>
          <div className="hl-cta">
            <div className="hl-row">
              <Link className="hl-btn hl-pri" href="/photo-check">사진으로 확인하기</Link>
              <Link className="hl-btn hl-out" href="/products">바로 견적확인하기</Link>
            </div>
            <a className="hl-btn hl-kk" href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer">
              <KakaoIcon /> 카카오로 문의하기
            </a>
          </div>
          <div className="hero2m-badges">
            {heroBadges.map((b) => (
              <span key={b} className="hero2-badge">{b}</span>
            ))}
          </div>
        </section>

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
            <p className="hero2-desc">사진으로 교체 가능 여부를 먼저 확인하고,<br />제품값과 시공비를 나눠 보고 예약할 수 있어요.</p>
            <div className="hero2-cta">
              <Link className="web-btn pri" href="/photo-check">사진으로 확인하기</Link>
              <Link className="web-btn outline" href="/products">바로 견적확인하기</Link>
              <a className="web-btn kkbtn" href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer">
                <KakaoIcon /> 카카오로 문의하기
              </a>
            </div>
          </div>
          <div className="hero2-right" aria-hidden="true">
            <div className="hero2-visual">
              <div className="hero2-cards">
                {heroItems.map((it) => (
                  <Link key={it.slug} className="hero2-card" href={`/products/${it.slug}`}>
                    <span className="hero2-card-im">
                      <img src={BUILDUSCARE_LINEUP_IMAGES[it.slug] ?? ""} alt="" loading="lazy" decoding="async" />
                    </span>
                    <span className="hero2-card-nm">{it.label}</span>
                  </Link>
                ))}
              </div>
              <div className="hero2-badges">
                {heroBadges.map((b) => (
                  <span key={b} className="hero2-badge">{b}</span>
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
