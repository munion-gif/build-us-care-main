import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllCases,
  getCaseBySlug,
  getRelatedCases,
  formatWon,
  formatDuration
} from "@/lib/cases-data";
import { CaseCard } from "../CaseCard";
import "../cases.css";

type PageProps = { params: Promise<{ slug: string }> };

const KAKAO_URL = "https://pf.kakao.com/_PxkzsX";

export function generateStaticParams() {
  return getAllCases().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = getCaseBySlug(slug);
  if (!item) return { title: "시공사례 | Build us Care" };
  const priceText = item.costTotal ? ` · ${formatWon(item.costTotal)}` : "";
  return {
    title: `${item.title}${priceText} | Build us Care`,
    description: item.summary,
    alternates: { canonical: `/cases/${item.slug}` },
    openGraph: {
      title: `${item.title}${priceText}`,
      description: item.summary,
      url: `/cases/${item.slug}`
    }
  };
}

export default async function CaseDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const item = getCaseBySlug(slug);
  if (!item) notFound();

  const related = getRelatedCases(slug);

  return (
    <div className="cases-wrap">
      <Link className="case-back" href="/cases">
        ← 시공사례 목록
      </Link>

      <h1 className="case-detail-title">
        {item.title}
        {item.costTotal ? (
          <>
            {" "}
            · <span className="price-inline">{formatWon(item.costTotal)}</span>
          </>
        ) : null}
      </h1>

      {/* 정보 박스 */}
      <div className="case-meta">
        <div className="row">
          <span className="k">지역</span>
          <span className="v">{item.region}</span>
        </div>
        <div className="row">
          <span className="k">시공 내용</span>
          <span className="v">{item.category} 교체</span>
        </div>
        {item.costTotal ? (
          <div className="row">
            <span className="k">비용</span>
            <span className="v">
              {formatWon(item.costTotal)} <span className="cost-break">(VAT 포함)</span>
              {item.costLabor || item.costProduct ? (
                <div className="cost-break">
                  공임비 {formatWon(item.costLabor)} + 제품비 {formatWon(item.costProduct)}
                </div>
              ) : null}
            </span>
          </div>
        ) : null}
        {item.durationMin ? (
          <div className="row">
            <span className="k">시공 시간</span>
            <span className="v">{formatDuration(item.durationMin)}</span>
          </div>
        ) : null}
      </div>

      {/* 본문 — 글과 사진이 섞여 흐릅니다 */}
      <div className="case-body">
        {item.body.map((block, i) => {
          if (block.kind === "text") {
            return (
              <section key={i} className="cb-text">
                {block.heading ? <h2>{block.heading}</h2> : null}
                <p>{block.text}</p>
              </section>
            );
          }
          // photos 블록
          const count = block.urls.length;
          return (
            <div key={i} className={`cb-photos count-${Math.min(count, 3)}`}>
              {block.label ? <span className="cb-photo-label">{block.label}</span> : null}
              <div className="cb-photo-grid">
                {block.urls.map((url, j) => (
                  <div className="cb-photo" key={j}>
                    {url ? <img src={url} alt={`${item.title} 사진 ${j + 1}`} loading="lazy" /> : <span>시공 사진</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 장점 체크리스트 */}
      {item.highlights && item.highlights.length > 0 ? (
        <div className="case-highlights">
          <h2>시공 후 이렇게 좋아졌어요</h2>
          <ul>
            {item.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* CTA */}
      <div className="case-cta">
        <h2>우리 집도 이렇게 바꿀 수 있어요</h2>
        <p>방문 견적 없이, 사진으로 먼저 확인하세요. 추가비·견적비 0원.</p>
        <div className="btns">
          <a className="kakao" href={KAKAO_URL} target="_blank" rel="noreferrer">
            카카오로 문의하기
          </a>
          <Link className="photo" href="/photo-check">
            사진으로 확인하기
          </Link>
        </div>
      </div>

      {/* 비슷한 사례 */}
      {related.length > 0 ? (
        <div className="case-related">
          <h2>비슷한 시공 사례</h2>
          <p className="sub">관련된 다른 시공 사례들도 확인해보세요.</p>
          <div className="cases-grid">
            {related.map((r) => (
              <CaseCard key={r.slug} item={r} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
