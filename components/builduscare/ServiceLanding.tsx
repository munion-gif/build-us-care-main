import Link from "next/link";
import { CalendarCheck, Camera, CircleCheck, Layers, LifeBuoy, ReceiptText, ShieldCheck } from "lucide-react";
import { MobileAppBar } from "@/components/builduscare/MobileAppChrome";

const benefits = [
  { eye: "사진 판정", title: "방문견적 없이 사진 3장.", text: "전체·문제부위·규격만 보내면 매니저가 직접 확인해 가능 여부를 알려드려요.", icon: Camera },
  { eye: "정찰가", title: "제품값과 시공비를 나눠서.", text: "뭉뚱그리지 않고 항목별로 투명하게. 추가 비용과 출장비는 없어요.", icon: ReceiptText },
  { eye: "정직한 진단", title: "교체 안 해도 됩니다.", text: "청소·조임으로 해결되면 그렇게 안내해요. 무조건 바꾸라 하지 않아요.", icon: ShieldCheck },
  { eye: "한 번의 방문", title: "여러 품목 함께 교체.", text: "수전·양변기·세면대를 한 번에 담아 한 번의 방문으로 끝내요.", icon: Layers },
  { eye: "사후 케어", title: "시공 후 보증과 A/S.", text: "완료 리포트와 보증으로 사후까지 책임지고 케어해요.", icon: LifeBuoy }
];

const knows = [
  { eye: "생활 리프레시", title: "낡아 보이는 작은 이유부터." },
  { eye: "호환 확인", title: "우리집에 맞는지 먼저." },
  { eye: "가격 투명", title: "제품값·시공비 분리." },
  { eye: "한 번의 방문", title: "여러 품목 함께." }
];

export function ServiceLanding() {
  return (
    <main className="bc-page service-page">
      <MobileAppBar title="서비스 소개" backHref="/" />

      <div className="bc-mobile-only mobile-service-screen">
        <p className="m-eyebrow">Build us Care 서비스</p>
        <h1>집 전체가 아니라,<br />바꿀 수 있는 것부터.</h1>
        <p>
          오래된 수전·변기·환풍기·손잡이. 방문견적 없이 사진 3장으로 우리 집에 맞는 제품인지 먼저 확인하고, 필요한 교체만 예약하는 생활 리프레시 케어 서비스예요.
        </p>

        <div className="mobile-flow">
          <article className="mobile-flow-card">
            <span className="m-icon"><Camera aria-hidden="true" /></span>
            <div><b>① 사진 3장 먼저</b><span>전체·문제부위·규격을 보내면 방문 없이 확인 시작.</span></div>
          </article>
          <article className="mobile-flow-card">
            <span className="m-icon"><CircleCheck aria-hidden="true" /></span>
            <div><b>② 가능 여부·정찰가</b><span>교체 가능·보류 가능·상담 필요를 솔직하게 구분.</span></div>
          </article>
          <article className="mobile-flow-card">
            <span className="m-icon"><CalendarCheck aria-hidden="true" /></span>
            <div><b>③ 예약·방문 교체</b><span>제품가·시공비를 나눠 확인, 필요할 때만 방문.</span></div>
          </article>
        </div>

        <h2 className="mobile-section-title">우리가 지키는 약속</h2>
        <article className="mobile-promise-card">
          <span className="m-icon"><ShieldCheck aria-hidden="true" /></span>
          <div><b>교체 안 해도 됩니다</b><span>청소·조임으로 해결되면 그렇게 안내해요.</span></div>
        </article>
        <article className="mobile-promise-card">
          <span className="m-icon"><ReceiptText aria-hidden="true" /></span>
          <div><b>제품값·시공비 분리</b><span>예상 금액을 투명하게. 동의 없는 추가는 없어요.</span></div>
        </article>
        <article className="mobile-promise-card">
          <span className="m-icon"><LifeBuoy aria-hidden="true" /></span>
          <div><b>시공 후 A/S</b><span>완료 리포트와 보증으로 사후까지 케어해요.</span></div>
        </article>

        <div className="mobile-bottom-cta">
          <Link className="web-btn pri lg" href="/photo-check"><Camera aria-hidden="true" /> 사진으로 먼저 확인하기</Link>
        </div>
      </div>

      <div className="wrap svc-page bc-desktop-only" style={{ maxWidth: 1320 }}>
        <section className="sec-head" style={{ maxWidth: 760 }}>
          <div className="eyebrow" style={{ color: "var(--brand-700)", fontSize: 13, fontWeight: 600 }}>Build us Care 서비스</div>
          <h1 className="web-h2" style={{ margin: "10px 0 0" }}>집 전체가 아니라,<br />바꿀 수 있는 것부터.</h1>
          <p className="web-lede" style={{ marginTop: 14 }}>
            오래된 수전·변기·환풍기·손잡이. 방문견적 없이 사진 3장으로 우리 집에 맞는 제품인지 먼저 확인하고, 필요한 교체만 예약하는 생활 리프레시 케어 서비스입니다.
          </p>
        </section>

        <section className="svc-sec">
          <div className="between svc-head">
            <div className="web-h2" style={{ fontSize: 34 }}>Build us Care에서<br />하면 좋은 이유.</div>
            <Link className="web-btn-link" href="/products">서비스 둘러보기 ›</Link>
          </div>
          <div className="svc-grid5">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <article key={benefit.eye} className="svc-card light">
                  <div className="svc-eye">{benefit.eye}</div>
                  <div className="svc-title">{benefit.title}</div>
                  <div className="svc-desc">{benefit.text}</div>
                  <div className="svc-art"><Icon aria-hidden="true" /></div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="svc-sec">
          <div className="web-h2" style={{ fontSize: 34, marginBottom: 24 }}>알면 알수록, 케어.</div>
          <div className="svc-grid4">
            {knows.map((item) => (
              <article key={item.eye} className="svc-card tall dark">
                <div className="svc-eye">{item.eye}</div>
                <div className="svc-title" style={{ fontSize: 20, whiteSpace: "nowrap", letterSpacing: "-.035em" }}>{item.title}</div>
                <div className="svc-photo imgph" />
              </article>
            ))}
          </div>
        </section>

        <section className="svc-sec">
          <div className="web-h2" style={{ fontSize: 34, marginBottom: 24 }}>필요한 것만, 합리적으로.</div>
          <div className="svc-two">
            <article className="svc-card2">
              <div className="svc2-txt">
                <div className="svc-title" style={{ fontSize: 26 }}>낡아 보이는 작은 이유,<br />사진으로 먼저.</div>
                <Link className="web-btn-link" style={{ marginTop: 14, display: "inline-block" }} href="/photo-check">사진으로 확인하기 ›</Link>
              </div>
              <div className="svc2-img imgph" />
            </article>
            <article className="svc-card2">
              <div className="svc2-txt">
                <div className="svc-title" style={{ fontSize: 26 }}>여러 품목도<br />한 번의 방문으로.</div>
                <Link className="web-btn-link" style={{ marginTop: 14, display: "inline-block" }} href="/products">바꿀 수 있는 제품 보기 ›</Link>
              </div>
              <div className="svc2-img imgph" />
            </article>
          </div>
        </section>

        <div className="cta-row service-cta-row" style={{ marginTop: 48 }}>
          <Link className="web-btn pri lg" href="/photo-check"><Camera aria-hidden="true" style={{ width: 18, height: 18 }} /> 사진으로 먼저 확인하기</Link>
          <Link className="web-btn sec lg" href="/products">바꿀 수 있는 제품 보기</Link>
        </div>

      </div>
    </main>
  );
}
