export const metadata = {
  title: "Build us Care",
  description: "집 전체가 아니라, 바꿀 수 있는 것부터.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    url: "/"
  }
};

const sections = [
  {
    title: "1. A/S 보증 범위",
    body: [
      "Build us Care가 시공한 작업에서 시공 하자, 누수, 고정 불량, 작동 불량 등 서비스 품질 문제가 확인되면 A/S를 안내합니다.",
      "보증 범위는 해당 주문에서 실제 시공한 품목과 작업 범위에 한정됩니다."
    ]
  },
  {
    title: "2. 접수 가능 시점",
    body: [
      "A/S는 시공 완료 후 최종 완료 상태에서 접수할 수 있습니다.",
      "작업 진행 중 발견된 문제는 A/S가 아니라 현장 이슈로 우선 확인하며, 담당자가 조치 방향을 안내합니다."
    ]
  },
  {
    title: "3. 보증 제외 사항",
    body: [
      "고객이 별도로 구매한 제품 자체의 제조상 하자, 기존 배관·벽체·타일·전기 설비의 노후 문제는 제조사 또는 별도 점검 대상일 수 있습니다.",
      "고객 임의 분해, 외부 충격, 사용상 부주의, 소모품 교체, 추가 공사 요청은 무상 A/S 범위에서 제외될 수 있습니다."
    ]
  },
  {
    title: "4. 접수 방법",
    body: [
      "주문 현황 페이지의 A/S 접수 기능 또는 카카오톡 상담으로 접수할 수 있습니다.",
      "문제 부위 사진, 주문번호, 증상 설명을 함께 보내주시면 더 빠르게 확인할 수 있습니다."
    ]
  },
  {
    title: "5. 처리 절차",
    body: [
      "접수 후 담당자가 사진과 주문 기록을 확인하고, 필요 시 전화 또는 카카오톡으로 추가 확인을 진행합니다.",
      "재방문이 필요한 경우 기사 일정과 방문 가능 지역을 기준으로 일정을 조율합니다."
    ]
  },
  {
    title: "6. 문의",
    body: ["A/S 문의: 주문 현황 페이지 또는 카카오톡 상담", "이메일: munion@mymunion.com"]
  }
];

export default function AsPolicyPage() {
  return (
    <main className="policy-page">
      <style>{policyCss}</style>
      <section className="policy-hero">
        <p>Build us Care</p>
        <h1>A/S 기준</h1>
        <span>시행일: 2026년 6월 12일</span>
      </section>
      <section className="policy-body">
        {sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            {section.body.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </article>
        ))}
      </section>
    </main>
  );
}

const policyCss = `
  .policy-page {
    background: #f7f6f2;
    color: #1c1b19;
  }
  .policy-hero,
  .policy-body {
    width: min(860px, 100%);
    margin: 0 auto;
    padding-inline: var(--space-6);
  }
  .policy-hero {
    padding-block: var(--space-12) var(--space-8);
  }
  .policy-hero p {
    margin: 0 0 8px;
    color: var(--color-primary);
    font-weight: 700;
  }
  .policy-hero h1 {
    margin: 0;
    font-size: var(--text-h1);
    line-height: var(--leading-h1);
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .policy-hero span {
    display: block;
    margin-top: 12px;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
  .policy-body {
    display: grid;
    gap: 14px;
    padding-bottom: var(--space-14);
  }
  .policy-body article {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: #fff;
    padding: 22px;
  }
  .policy-body h2 {
    margin: 0 0 12px;
    font-size: 1.1rem;
  }
  .policy-body p {
    margin: 8px 0 0;
    color: var(--color-text-muted);
    line-height: 1.75;
  }
  @media (max-width: 640px) {
    .policy-hero,
    .policy-body {
      padding-inline: var(--space-4);
    }
    .policy-body article {
      padding: 18px;
    }
  }
`;
