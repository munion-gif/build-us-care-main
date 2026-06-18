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
        <p className="adm-muted">고객 정보는 이 화면에서 직접 수정하지 않고, 접수 원본 기준으로 확인만 합니다.</p>
        <div className="adm-admin-info-grid">
          <span><b>고객명</b><strong>{order.customers?.name ?? "-"}</strong></span>
          <span><b>전화번호</b><strong>{order.customers?.phone ?? "-"}</strong></span>
          <span><b>주소</b><strong>{address}</strong></span>
          <span><b>주문 메모</b><strong>{order.special_requests || "-"}</strong></span>
        </div>

        {firstWarranty && (
          <>
            <hr className="adm-divider" />
            <div className="adm-admin-info-grid">
              <span><b>A/S 상태</b><strong>{firstWarranty.status ?? "-"}</strong></span>
              <span><b>책임 구분</b><strong>{firstWarranty.responsibility ?? "-"}</strong></span>
              <span><b>해결 여부</b><strong>{firstWarranty.resolved_at ? "해결 완료" : "진행 중"}</strong></span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
