"use client";

import { useMemo, useState } from "react";

type Technician = {
  id: string;
  name: string;
  region?: string | null;
};

type Props = {
  order: any;
  technicians: Technician[];
  localMode?: boolean;
};

function asArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function firstActiveJob(order: any) {
  return asArray(order.jobs)
    .filter((item) => item.status !== "cancelled")
    .sort((a, b) => String(b.scheduled_at ?? b.created_at ?? "").localeCompare(String(a.scheduled_at ?? a.created_at ?? "")))[0] ?? null;
}

function dateFromScheduledAt(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function slotFromScheduledAt(value?: string | null) {
  if (!value) return "morning";
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(new Date(value)));
  return hour < 13 ? "morning" : "afternoon";
}

function scheduledAt(date: string, slot: string) {
  return `${date}T${slot === "afternoon" ? "13:00:00" : "09:00:00"}+09:00`;
}

export function OrderEditPanel({ order, technicians, localMode = false }: Props) {
  const activeJob = useMemo(() => firstActiveJob(order), [order]);
  const warrantyCases = asArray(order.warranty_cases);
  const firstWarranty = warrantyCases[0] ?? null;

  const [customerName, setCustomerName] = useState(order.customers?.name ?? "");
  const [customerPhone, setCustomerPhone] = useState(order.customers?.phone ?? "");
  const [addressFull, setAddressFull] = useState(order.homes?.address_full ?? order.customers?.address_full ?? "");
  const [addressDong, setAddressDong] = useState(order.homes?.address_dong ?? order.customers?.address_dong ?? "");
  const [addressApt, setAddressApt] = useState(order.homes?.address_apt ?? order.customers?.address_apt ?? "");
  const [specialRequests, setSpecialRequests] = useState(order.special_requests ?? "");
  const [reservedDate, setReservedDate] = useState(dateFromScheduledAt(activeJob?.scheduled_at));
  const [timeSlot, setTimeSlot] = useState(slotFromScheduledAt(activeJob?.scheduled_at));
  const [technicianId, setTechnicianId] = useState(activeJob?.technician_id ?? technicians[0]?.id ?? "");
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

  async function saveTechnician() {
    if (localMode) {
      setMessage("로컬 확인 모드에서는 기사 배정을 저장할 수 없어요.");
      return;
    }
    if (!technicianId || !reservedDate) {
      setMessage("기사와 방문 날짜를 선택해주세요.");
      return;
    }
    if (!window.confirm("담당 기사와 방문 예정 시각을 저장할까요? 방문 확정은 별도 버튼으로 처리됩니다.")) return;
    setSaving("technician");
    setMessage("");
    try {
      const response = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.id,
          technician_id: technicianId,
          scheduled_at: scheduledAt(reservedDate, timeSlot)
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "기사 배정에 실패했습니다.");
      setMessage("기사 배정을 저장했습니다. 고객에게 방문 확정으로 안내하려면 방문 확정을 눌러주세요.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "기사 배정에 실패했습니다.");
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

        <hr className="adm-divider" />

        <div className="adm-form-row adm-form-row-3">
          <label><span className="adm-label">방문 날짜</span><input className="adm-input" type="date" value={reservedDate} onChange={(event) => setReservedDate(event.target.value)} disabled={localMode} /></label>
          <label>
            <span className="adm-label">시간대</span>
            <select className="adm-input" value={timeSlot} onChange={(event) => setTimeSlot(event.target.value)} disabled={localMode}>
              <option value="morning">오전</option>
              <option value="afternoon">오후</option>
            </select>
          </label>
          <label>
            <span className="adm-label">담당 기사</span>
            <select className="adm-input" value={technicianId} onChange={(event) => setTechnicianId(event.target.value)} disabled={localMode}>
              <option value="">기사 선택</option>
              {technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.name}{technician.region ? ` (${technician.region})` : ""}</option>)}
            </select>
          </label>
        </div>
        <div className="adm-inline-actions">
          <button className="adm-btn adm-btn-primary adm-btn-sm" type="button" disabled={saving === "technician" || localMode} onClick={saveTechnician}>
            {saving === "technician" ? "저장 중..." : localMode ? "로컬에서 저장 불가" : "기사 배정 저장"}
          </button>
        </div>

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
