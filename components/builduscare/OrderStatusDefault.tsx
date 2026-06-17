import Link from "next/link";
import { Check, ChevronLeft, Info, MessageCircle } from "lucide-react";
import { MobileAppBar } from "@/components/builduscare/MobileAppChrome";

const statusSteps = [
  { state: "done", title: "사진 확인 접수", description: "접수 완료" },
  { state: "now", title: "매니저 확인 중", description: "가능 여부·정찰가 확인" },
  { state: "todo", title: "견적·예약 확정", description: "동의 후 진행" },
  { state: "todo", title: "방문 교체", description: "희망 일정 기준" },
  { state: "todo", title: "완료 · 보증 시작", description: "완료 리포트 · A/S" }
];

export function OrderStatusDefault() {
  return (
    <main className="bc-page order-status-default-page">
      <MobileAppBar title="주문 확인" backHref="/order-lookup" />

      <div className="wrap narrow order-status-default-wrap bc-desktop-only">
        <div className="order-status-default-head">
          <h1 className="p-sm strong">주문 확인</h1>
          <Link className="web-btn sec" href="/order-lookup">
            <ChevronLeft aria-hidden="true" size={18} />
            조회
          </Link>
        </div>

        <section className="bcard pad order-status-default-card">
          <span className="badge badge-warning dot">확인 중</span>
          <div className="note info order-status-default-note">
            <div>
              <b>매니저가 사진을 확인 중이에요</b>
              <br />
              영업시간 기준 2시간 내 견적을 카카오톡으로 안내해 드릴게요.
            </div>
          </div>

          <div className="timeline order-status-default-timeline">
            {statusSteps.map((step) => (
              <div key={step.title} className={`tl ${step.state}`}>
                <div className="order-status-step-mark" aria-hidden="true">
                  {step.state === "done" && <Check size={14} />}
                </div>
                <div className="tlt">{step.title}</div>
                <div className="tld">{step.description}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bcard pad order-status-default-card info-card">
          <h2 className="h-sm">예약 정보</h2>
          <dl className="bc-specs">
            <div>
              <dt>예약자</dt>
              <dd>-</dd>
            </div>
            <div>
              <dt>연락처</dt>
              <dd>-</dd>
            </div>
            <div>
              <dt>시공 주소</dt>
              <dd>-</dd>
            </div>
            <div>
              <dt>예약 일시</dt>
              <dd>사진 확인 후 협의</dd>
            </div>
            <div>
              <dt>현금영수증</dt>
              <dd>신청 안 함</dd>
            </div>
          </dl>
          <div className="note info">
            <Info aria-hidden="true" />
            <div>사진 호환제품 문의 접수예요. 매니저가 사진을 확인해 호환 제품과 견적을 안내드려요.</div>
          </div>
        </section>

        <a className="web-btn sec order-status-kakao" href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer">
          <MessageCircle aria-hidden="true" size={18} />
          카카오톡 상담
        </a>
      </div>

      <div className="wrap narrow order-status-default-mobile bc-mobile-only">
        <section className="bcard pad order-status-default-card">
          <span className="badge badge-warning dot">확인 중</span>
          <div className="note info order-status-default-note">
            <div>
              <b>매니저가 사진을 확인 중이에요</b>
              <br />
              영업시간 기준 2시간 내 견적을 카카오톡으로 안내해 드릴게요.
            </div>
          </div>

          <div className="timeline order-status-default-timeline">
            {statusSteps.map((step) => (
              <div key={`mobile-${step.title}`} className={`tl ${step.state}`}>
                <div className="order-status-step-mark" aria-hidden="true">
                  {step.state === "done" && <Check size={14} />}
                </div>
                <div className="tlt">{step.title}</div>
                <div className="tld">{step.description}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bcard pad order-status-default-card info-card">
          <h2 className="h-sm">예약 정보</h2>
          <dl className="bc-specs">
            <div>
              <dt>예약자</dt>
              <dd>-</dd>
            </div>
            <div>
              <dt>연락처</dt>
              <dd>-</dd>
            </div>
            <div>
              <dt>시공 주소</dt>
              <dd>-</dd>
            </div>
            <div>
              <dt>예약 일시</dt>
              <dd>사진 확인 후 협의</dd>
            </div>
            <div>
              <dt>현금영수증</dt>
              <dd>신청 안 함</dd>
            </div>
          </dl>
          <div className="note info">
            <Info aria-hidden="true" />
            <div>사진 호환제품 문의 접수예요. 매니저가 사진을 확인해 호환 제품과 견적을 안내드려요.</div>
          </div>
        </section>

        <a className="web-btn sec lg block order-status-kakao-mobile" href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer">
          <MessageCircle aria-hidden="true" size={18} />
          카카오톡 상담
        </a>
      </div>
    </main>
  );
}
