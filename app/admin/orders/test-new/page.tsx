import { getAllServiceItems } from "@/lib/service-items";

export const dynamic = "force-dynamic";

export default async function AdminTestOrderNewPage() {
  const services = await getAllServiceItems();
  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">실제 흐름으로 테스트</h1>
        <p className="adm-page-sub">고객이 보는 견적·예약·결제 흐름을 그대로 사용합니다. 관리자 세션에서 시작한 주문만 테스트 주문으로 저장됩니다.</p>
      </header>
      <div className="adm-content adm-stack">
        <section className="adm-card adm-stack">
          <div>
            <h2 className="adm-card-title">테스트할 서비스를 선택하세요</h2>
            <p className="adm-muted">선택 후 실제 견적 페이지로 이동합니다. 페이지 상단에 테스트 모드 표시가 보이면 정상입니다.</p>
          </div>
          <div className="adm-workflow-strip">
            {services.map((service) => (
              <a className="adm-workflow-card" href={`/quote/${service.service_type_code}?adminTest=1`} key={service.service_type_code}>
                <span className="adm-workflow-step">T</span>
                <strong>{service.display_name}</strong>
                <small>실제 주문 흐름으로 테스트 시작</small>
              </a>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
