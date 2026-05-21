"use client";

type BookingGuidePanelProps = {
  instagram?: boolean;
};

export function BookingGuidePanel({ instagram = false }: BookingGuidePanelProps) {
  const title = instagram
    ? "사진 확인부터 A/S 가능 단계까지, 어디까지 진행됐는지 바로 알 수 있어요"
    : "작업만 고르면, 견적·결제·예약·A/S 조건까지 이어집니다";

  return (
    <aside className="service-guide-panel" aria-label="예약 안내">
      <span>{instagram ? "첫 방문 고객 안내" : "예약 흐름"}</span>
      <h2>{title}</h2>
      <ol>
        <li>
          <b>1</b>
          <div>
            <strong>{instagram ? "사진 또는 서비스 선택" : "작업 선택"}</strong>
            <p>{instagram ? "애매하면 사진부터 보내고, 확실하면 정찰가 견적으로 바로 이동해요." : "정찰가 작업은 견적 화면에서 금액을 먼저 확인합니다."}</p>
          </div>
        </li>
        <li>
          <b>2</b>
          <div>
            <strong>사진·주소 확인</strong>
            <p>현장 조건과 방문 지역을 확인해 추가 안내가 필요한지 판단합니다.</p>
          </div>
        </li>
        <li>
          <b>3</b>
          <div>
            <strong>결제 후 일정 확정</strong>
            <p>결제 후 주문 링크에서 기사 배정과 방문 일정을 확인합니다.</p>
          </div>
        </li>
        <li>
          <b>4</b>
          <div>
            <strong>최종 완료 후 A/S</strong>
            <p>작업 완료 확인이 끝난 최종 완료 상태에서 A/S 접수가 열립니다.</p>
          </div>
        </li>
      </ol>
      <div className="service-guide-quote">
        <strong>결제 전 총액 확인</strong>
        <p>문의에서 바로 결제로 넘어가지 않고, 견적 범위와 금액을 먼저 확인합니다.</p>
      </div>
    </aside>
  );
}
