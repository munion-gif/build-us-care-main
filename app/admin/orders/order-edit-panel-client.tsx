"use client";

import { useState } from "react";

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

  const [customerName, setCustomerName] = useState(order.customers?.name ?? "");
  const [customerPhone, setCustomerPhone] = useState(order.customers?.phone ?? "");
  const [addressFull, setAddressFull] = useState(order.homes?.address_full ?? order.customers?.address_full ?? "");
  const [addressDong, setAddressDong] = useState(order.homes?.address_dong ?? order.customers?.address_dong ?? "");
  const [addressApt, setAddressApt] = useState(order.homes?.address_apt ?? order.customers?.address_apt ?? "");
  const [specialRequests, setSpecialRequests] = useState(order.special_requests ?? "");
  const [warrantyStatus, setWarrantyStatus] = useState(firstWarranty?.status ?? "open");
  const [warrantyResponsibility, setWarrantyResponsibility] = useState(firstWarranty?.responsibility ?? "");
  const [warrantyResolved, setWarrantyResolved] = useState(Boolean(firstWarranty?.resolved_at));
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function saveOrderInfo() {
    if (localMode) {
      setMessage("로컬 확인 모드에서는 고객/주문 정보를 저장할 수 없어요.");
      return;
    }
    if (!window.confirm("고객/주문 정보를 수정할까요?")) return;
    setSaving("order");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: customerName, phone: customerPhone },
          home: { address_full: addressFull, address_dong: addressDong || "unknown", address_apt: addressApt || null },
          order: { special_requests: specialRequests || null }
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "정보 수정에 실패했습니다.");
      setMessage("고객/주문 정보를 저장했습니다.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "정보 수정에 실패했습니다.");
    } finally {
      setSaving(null);
    }
  }

  async function saveWarranty() {
    if (!firstWarranty) return;
    if (localMode) {
      setMessage("로컬 확인 모드에서는 A/S 상태를 저장할 수 없어요.");
      return;
    }
    if (!window.confirm("A/S 상태를 수정할까요?")) return;
    setSaving("warranty");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warranty: {
            id: firstWarranty.id,
            status: warrantyStatus,
            responsibility: warrantyResponsibility || null,
            resolved: warrantyResolved
          }
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "A/S 수정에 실패했습니다.");
      setMessage("A/S 상태를 저장했습니다.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "A/S 수정에 실패했습니다.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="adm-card">
      <h2 className="adm-card-title">정보 수정</h2>
      <div className="adm-stack">
        <div className="adm-form-row adm-form-row-3">
          <label><span className="adm-label">고객명</span><input className="adm-input" value={customerName} onChange={(event) => setCustomerName(event.target.value)} disabled={localMode} /></label>
          <label><span className="adm-label">전화번호</span><input className="adm-input" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} disabled={localMode} /></label>
          <label><span className="adm-label">주문 메모</span><input className="adm-input" value={specialRequests} onChange={(event) => setSpecialRequests(event.target.value)} disabled={localMode} /></label>
        </div>
        <div className="adm-form-row adm-form-row-3">
          <label><span className="adm-label">주소</span><input className="adm-input" value={addressFull} onChange={(event) => setAddressFull(event.target.value)} disabled={localMode} /></label>
          <label><span className="adm-label">동/지역</span><input className="adm-input" value={addressDong} onChange={(event) => setAddressDong(event.target.value)} disabled={localMode} /></label>
          <label><span className="adm-label">아파트/단지</span><input className="adm-input" value={addressApt} onChange={(event) => setAddressApt(event.target.value)} disabled={localMode} /></label>
        </div>
        <button className="adm-btn adm-btn-primary adm-btn-sm" type="button" disabled={saving === "order" || localMode} onClick={saveOrderInfo}>
          {saving === "order" ? "저장 중..." : localMode ? "로컬에서 저장 불가" : "고객/주문 정보 저장"}
        </button>

        {firstWarranty && (
          <>
            <hr className="adm-divider" />
            <div className="adm-form-row adm-form-row-3">
              <label><span className="adm-label">A/S 상태</span><input className="adm-input" value={warrantyStatus} onChange={(event) => setWarrantyStatus(event.target.value)} disabled={localMode} /></label>
              <label><span className="adm-label">책임 구분</span><input className="adm-input" value={warrantyResponsibility} onChange={(event) => setWarrantyResponsibility(event.target.value)} placeholder="예: 시공/제품/고객" disabled={localMode} /></label>
              <label className="adm-inline-check"><input type="checkbox" checked={warrantyResolved} onChange={(event) => setWarrantyResolved(event.target.checked)} disabled={localMode} /> 해결 완료 처리</label>
            </div>
            <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" disabled={saving === "warranty" || localMode} onClick={saveWarranty}>
              {saving === "warranty" ? "저장 중..." : localMode ? "로컬에서 저장 불가" : "A/S 상태 저장"}
            </button>
          </>
        )}

        {localMode ? <p className="adm-help">로컬 확인 모드에서는 주문 상세 수정과 A/S 편집이 비활성입니다.</p> : null}
        {message && <p className="adm-form-message">{message}</p>}
      </div>
    </section>
  );
}
