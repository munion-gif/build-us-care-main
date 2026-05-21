export const metadata = {
  title: "개인정보처리방침 | Buildus Care",
  description: "Buildus Care 개인정보 처리 목적, 보관 기간, 위탁 및 권리 행사 안내"
};

const sections = [
  {
    title: "1. 수집하는 개인정보",
    body: [
      "주문 및 상담 진행을 위해 이름, 휴대폰 번호, 방문 주소, 주거 형태, 요청사항, 업로드 사진을 수집합니다.",
      "결제 처리 시 결제 승인 정보와 주문번호를 처리하며, 카드번호 등 결제수단의 민감한 원문 정보는 Buildus Care가 직접 저장하지 않습니다."
    ]
  },
  {
    title: "2. 이용 목적",
    body: [
      "견적 산정, 방문 예약, 시공 기사 배정, 결제 확인, 주문 상태 안내, A/S 및 고객 문의 응대에 사용합니다.",
      "서비스 품질 개선을 위해 주문 단계, 유입 경로, 화면 이용 기록 등 비식별 또는 최소한의 이용 정보를 분석할 수 있습니다."
    ]
  },
  {
    title: "3. 보관 기간",
    body: [
      "주문 및 결제 기록은 전자상거래 관련 법령상 보관 의무에 따라 필요한 기간 동안 보관합니다.",
      "상담 또는 견적만 진행된 정보는 목적 달성 후 지체 없이 파기하되, 분쟁 대응과 운영 기록이 필요한 경우 관련 법령이 허용하는 범위에서 보관합니다."
    ]
  },
  {
    title: "4. 제3자 제공 및 위탁",
    body: [
      "방문 시공을 위해 필요한 범위에서 담당 기사에게 고객 연락처, 방문 주소, 작업 요청 정보를 제공할 수 있습니다.",
      "결제는 Toss Payments 등 결제대행사를 통해 처리되며, 알림 발송이나 데이터 보관을 위해 클라우드·메시징 서비스 제공업체를 이용할 수 있습니다."
    ]
  },
  {
    title: "5. 이용자 권리",
    body: [
      "고객은 개인정보 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다.",
      "요청은 고객센터 또는 이메일로 접수할 수 있으며, 본인 확인 후 관련 법령에 따라 처리합니다."
    ]
  },
  {
    title: "6. 문의",
    body: ["개인정보 관련 문의: munion@mymunion.com", "운영사: 주식회사 무니온(muniOn), 사업자등록번호 601-81-39840"]
  }
];

export default function PrivacyPage() {
  return (
    <main className="policy-page">
      <style>{policyCss}</style>
      <section className="policy-hero">
        <p>Buildus Care</p>
        <h1>개인정보처리방침</h1>
        <span>시행일: 2026년 5월 18일</span>
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
    font-weight: 900;
  }
  .policy-hero h1 {
    margin: 0;
    font-size: clamp(2rem, 5vw, 3.2rem);
    letter-spacing: 0;
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
