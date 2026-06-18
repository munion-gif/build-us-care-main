type Props = {
  order: any;
  localMode?: boolean;
};

function asArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function OrderEditPanel({ order, localMode = false }: Props) {
  const warrantyCases = asArray(order.warranty_cases);
  const firstWarranty = warrantyCases[0] ?? null;
  const address = [
    order.homes?.address_full ?? order.customers?.address_full,
    order.homes?.address_dong ?? order.customers?.address_dong,
    order.homes?.address_apt ?? order.customers?.address_apt
  ].filter(Boolean).join(" ") || "-";

  return (
    <section className="adm-card">
      <h2 className="adm-card-title">정보 수정</h2>
      <div className="adm-stack">
        <p className="adm-muted">접수 원본 정보입니다. 이 화면에서는 값 확인만 가능하고 수정은 비활성입니다.</p>
        <div className="adm-form-row adm-form-row-3">
          <label><span className="adm-label">고객명</span><input className="adm-input" value={order.customers?.name ?? ""} disabled readOnly /></label>
          <label><span className="adm-label">전화번호</span><input className="adm-input" value={order.customers?.phone ?? ""} disabled readOnly /></label>
          <label><span className="adm-label">주문 메모</span><input className="adm-input" value={order.special_requests ?? ""} disabled readOnly /></label>
        </div>
        <div className="adm-form-row adm-form-row-3">
          <label><span className="adm-label">주소</span><input className="adm-input" value={order.homes?.address_full ?? order.customers?.address_full ?? ""} disabled readOnly /></label>
          <label><span className="adm-label">동/지역</span><input className="adm-input" value={order.homes?.address_dong ?? order.customers?.address_dong ?? ""} disabled readOnly /></label>
          <label><span className="adm-label">아파트/단지</span><input className="adm-input" value={order.homes?.address_apt ?? order.customers?.address_apt ?? ""} disabled readOnly /></label>
        </div>
        <p className="adm-help">표시 주소: {address}</p>

        {firstWarranty && (
          <>
            <hr className="adm-divider" />
            <div className="adm-form-row adm-form-row-3">
              <label><span className="adm-label">A/S 상태</span><input className="adm-input" value={firstWarranty.status ?? ""} disabled readOnly /></label>
              <label><span className="adm-label">책임 구분</span><input className="adm-input" value={firstWarranty.responsibility ?? ""} disabled readOnly /></label>
              <label><span className="adm-label">해결 여부</span><input className="adm-input" value={firstWarranty.resolved_at ? "해결 완료" : "진행 중"} disabled readOnly /></label>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
