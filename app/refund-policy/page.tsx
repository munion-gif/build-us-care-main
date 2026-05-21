export const metadata = {
  title: "취소·환불 안내 | Buildus Care",
  description: "Buildus Care 예약 취소, 환불, 방문 변경, A/S 안내"
};

const sections = [
  {
    title: "1. 결제 전 취소",
    body: ["견적 확인 전 또는 결제 전에는 별도 비용 없이 주문을 취소할 수 있습니다.", "이미 사진 판정이나 상담이 진행된 경우에도 결제 전이라면 방문 예약은 확정되지 않습니다."]
  },
  {
    title: "2. 결제 후 방문 전 취소",
    body: [
      "결제 후 24시간 이내이면서 방문 예정일 3일 전까지는 전액 환불을 원칙으로 합니다.",
      "방문 당일 또는 기사 출발 이후 취소는 이동비, 사전 준비 비용, 이미 구매한 자재 비용이 차감될 수 있습니다."
    ]
  },
  {
    title: "3. 일정 변경",
    body: [
      "방문 일정 변경은 주문 현황 페이지 또는 카카오 상담으로 요청할 수 있습니다.",
      "가능한 방문 슬롯과 담당 기사 일정에 따라 변경 가능 시간이 달라질 수 있습니다."
    ]
  },
  {
    title: "4. 시공 후 환불 및 A/S",
    body: [
      "시공 완료 후 단순 변심에 따른 환불은 제한될 수 있습니다.",
      "시공 하자, 누수, 작동 불량 등 서비스 품질 문제가 확인되면 A/S 접수 후 재방문 또는 필요한 조치를 안내합니다."
    ]
  },
  {
    title: "5. 환불 처리 기간",
    body: [
      "카드 결제 환불은 결제대행사와 카드사 처리 일정에 따라 영업일 기준 며칠이 소요될 수 있습니다.",
      "부분 환불이 필요한 경우 고객에게 차감 사유와 금액을 먼저 안내합니다."
    ]
  },
  {
    title: "6. 문의",
    body: ["취소·환불 문의: 주문 현황 페이지의 취소 요청 또는 카카오 상담", "이메일: munion@mymunion.com"]
  }
];

export default function RefundPolicyPage() {
  return (
    <main className="policy-page">
      <style>{policyCss}</style>
      <section className="policy-hero">
        <p>Buildus Care</p>
        <h1>취소·환불 안내</h1>
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
