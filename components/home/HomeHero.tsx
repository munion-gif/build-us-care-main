"use client";

import { Camera, CheckCircle2, Search } from "lucide-react";
import type { SourceContext } from "@/lib/traffic-source";

type HomeHeroProps = {
  sourceContext: SourceContext;
  query: string;
  photoHref: string;
  onQueryChange: (value: string) => void;
};

function heroCopy(context: SourceContext) {
  if (context.trafficSource === "instagram") {
    return {
      eyebrow: "Instagram에서 오셨나요?",
      title: "사진만 보내도, 우리 집 교체 가능 여부부터 확인해드려요",
      body: "제품 호환을 사진으로 먼저 확인하고, 방문은 교체가 필요할 때만 진행합니다.",
      primary: "사진확인"
    };
  }

  if (context.trafficSource === "kakao") {
    return {
      eyebrow: "상담 이어가기",
      title: "상담 이어서 진행할 작업을 선택해주세요",
      body: "카톡에서 확인한 내용을 기준으로 작업을 고르고, 주소와 방문 일정을 이어서 남길 수 있어요.",
      primary: "사진확인"
    };
  }

  if (context.trafficSource === "organic") {
    return {
      eyebrow: "시공 사례와 정찰가 확인",
      title: "우리 집과 비슷한 작업을 찾고 정찰가를 확인하세요",
      body: "대표 작업은 금액을 먼저 확인하고, 애매한 작업은 사진으로 제품 호환을 확인합니다.",
      primary: "사진확인"
    };
  }

  return {
    eyebrow: "제품교체 · 호환확인 · 예약접수",
    title: "사진 3장으로 제품 호환 확인하기",
    body: "방문은 교체가 필요할 때만 진행합니다. 사진으로 먼저 확인하고, 가능한 작업만 견적과 예약으로 이어갑니다.",
    primary: "사진확인"
  };
}

const quickPicks = ["변기 교체", "수전 교체", "전등 교체", "콘센트 교체"];

export function HomeHero({ sourceContext, query, photoHref, onQueryChange }: HomeHeroProps) {
  const copy = heroCopy(sourceContext);
  const isInstagram = sourceContext.trafficSource === "instagram";

  return (
    <section className="home-hero">
      <div className="hero-copy">
        <span className="brand-kicker">build us care</span>
        <p className={isInstagram ? "hero-instagram-badge" : ""}>{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <span className="hero-description">{copy.body}</span>
        {!isInstagram && (
          <div className="hero-finder">
            <label className="home-search">
              <Search size={20} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="어떤 작업이 필요하세요? ex) 변기 교체"
                aria-label="서비스 검색"
              />
            </label>
            <div className="hero-quick-picks" aria-label="자주 찾는 작업">
              <span>자주 찾는 작업</span>
              <div>
                {quickPicks.map((item) => (
                  <button key={item} type="button" onClick={() => onQueryChange(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="hero-actions" aria-label="주요 시작 버튼">
          <a href={photoHref}>
            <Camera size={17} />
            {copy.primary}
          </a>
          <a href="#instant-services">대표 작업 보기</a>
        </div>
      </div>
      <div className="hero-visual" aria-label="집수리 사진 판정 예시">
        <img
          src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80"
          alt="집수리 전문가가 실내 설비를 점검하는 모습"
        />
        <div className="diagnostic-label-card" aria-hidden="true">
          <span>build us care</span>
          <strong>photo diagnosis</strong>
          <small>send 3 photos first</small>
          <dl>
            <div><dt>case id</dt><dd>BC-2605</dd></div>
            <div><dt>type</dt><dd>home product</dd></div>
            <div><dt>status</dt><dd>diagnosing</dd></div>
          </dl>
        </div>
        <div className="hero-visual-note">
          <span><CheckCircle2 size={16} /> 사진 먼저 확인</span>
          <strong>교체가 필요한 경우만 견적으로 연결</strong>
        </div>
      </div>
    </section>
  );
}
