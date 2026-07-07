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
    title: "1. 목적",
    body: [
      "본 약관은 주식회사 무니온이 운영하는 Build us Care 서비스의 이용 조건과 절차, 회사와 이용자의 권리와 의무를 정합니다.",
      "Build us Care는 사진 확인, 제품 선택, 견적 안내, 방문 예약, 시공 및 사후 상담을 제공하는 생활 교체 서비스입니다."
    ]
  },
  {
    title: "2. 서비스 이용",
    body: [
      "이용자는 사진, 주소, 연락처, 요청 품목 등 견적과 방문에 필요한 정보를 정확하게 제공해야 합니다.",
      "사진 확인 결과와 예상 견적은 현장 조건, 제품 호환 여부, 추가 요청에 따라 최종 금액과 달라질 수 있습니다."
    ]
  },
  {
    title: "3. 주문과 예약",
    body: [
      "제품 주문은 제품 금액 입금 확인 또는 회사가 안내한 절차가 완료된 뒤 진행됩니다.",
      "방문 예약은 기사 일정, 예약 가능 지역, 공휴일 및 운영 정책에 따라 확정되며, 확정 전까지 일정이 변경될 수 있습니다."
    ]
  },
  {
    title: "4. 결제와 비용",
    body: [
      "제품비, 시공비, 폐기물 처리비 등 주요 비용은 항목별로 안내합니다.",
      "계좌이체 등 현금성 결제의 경우 입금자명, 입금 금액, 주문번호 확인 후 주문이 진행됩니다."
    ]
  },
  {
    title: "5. 이용자의 의무",
    body: [
      "이용자는 허위 정보, 타인 정보 도용, 서비스 운영을 방해하는 행위를 해서는 안 됩니다.",
      "현장 방문 시 작업 공간 확보, 기존 설비 상태 고지, 안전한 작업 환경 제공에 협조해야 합니다."
    ]
  },
  {
    title: "6. 저작권 및 무단 이용 금지",
    body: [
      "본 사이트의 상호·로고·디자인·문구·이미지(시공 사례 사진 포함)·가격 정보 및 구성 일체에 대한 저작권과 지식재산권은 주식회사 무니온에 있습니다.",
      "회사의 사전 서면 동의 없이 사이트의 콘텐츠를 복제·전재·배포·2차 가공하거나, 자동화된 수단(크롤러·스크래퍼·봇 등)으로 수집·저장하는 행위를 금지합니다.",
      "무단 이용이 확인될 경우 저작권법 등 관련 법령에 따라 민·형사상 책임을 물을 수 있습니다."
    ]
  },
  {
    title: "7. 책임의 제한",
    body: [
      "노후 배관, 벽체 손상, 기존 설비의 숨은 하자 등 사진만으로 확인하기 어려운 사항은 현장 확인 후 별도 안내할 수 있습니다.",
      "천재지변, 교통 상황, 부품 수급, 고객 사정 등 불가피한 사유가 있는 경우 예약이나 작업 일정이 조정될 수 있습니다."
    ]
  },
  {
    title: "8. 문의",
    body: ["서비스 이용 문의: 카카오톡 상담 또는 munion@mymunion.com", "운영사: 주식회사 무니온(muniOn), 사업자등록번호 601-81-39840"]
  }
];

export default function TermsPage() {
  return (
    <main className="policy-page">
      <style>{policyCss}</style>
      <section className="policy-hero">
        <p>Build us Care</p>
        <h1>이용약관</h1>
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
