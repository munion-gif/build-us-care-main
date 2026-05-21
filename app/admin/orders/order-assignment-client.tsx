"use client";

import { useEffect, useMemo, useState } from "react";

type Technician = {
  id: string;
  name: string;
  region?: string | null;
  is_active?: boolean | null;
};

type Reservation = {
  reserved_date?: string | null;
  reservation_date?: string | null;
  time_slot?: string | null;
  status?: string | null;
};

type Job = {
  id: string;
  technician_id?: string | null;
  scheduled_at?: string | null;
  status?: string | null;
};

type Props = {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  reservations?: Reservation[];
  jobs?: Job[];
  technicians: Technician[];
  compact?: boolean;
};

function tomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function timeFromSlot(slot?: string | null) {
  if (slot === "afternoon") return "13:00";
  return "09:00";
}

function slotFromTime(time: string) {
  return Number(time.slice(0, 2)) < 13 ? "morning" : "afternoon";
}

function jobSlot(job: Job) {
  if (!job.scheduled_at) return null;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(new Date(job.scheduled_at)));
  return hour < 13 ? "morning" : "afternoon";
}

function reservationLabel(date: string, time: string) {
  return `${date} ${slotFromTime(time) === "morning" ? "오전" : "오후"}`;
}

export function OrderScheduleConfirmButton({
  orderId,
  disabled,
  reason
}: {
  orderId: string;
  disabled: boolean;
  reason: string;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function confirmSchedule() {
    if (disabled) {
      setMessage(reason);
      return;
    }
    if (!window.confirm("담당 기사와 예약 시간을 확정하고 고객에게 방문 확정 상태로 보여줄까요?")) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/confirm-reservation`, { method: "POST" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "예약 확정에 실패했습니다.");
      setMessage("예약을 확정했습니다.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "예약 확정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-inline-actions">
      <button className="adm-btn adm-btn-primary adm-btn-sm" type="button" disabled={saving} onClick={confirmSchedule}>
        {saving ? "확정 중..." : "예약 확정"}
      </button>
      {message && <span className="adm-help" style={{ marginTop: 0 }}>{message}</span>}
    </div>
  );
}

export function OrderAssignmentButton({ orderId, orderNumber, orderStatus, reservations = [], jobs = [], technicians, compact }: Props) {
  const firstReservation = reservations.find((reservation) => reservation.status !== "cancelled") ?? reservations[0];
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(firstReservation?.reserved_date ?? firstReservation?.reservation_date ?? tomorrowDate());
  const [time, setTime] = useState(timeFromSlot(firstReservation?.time_slot));
  const [technicianId, setTechnicianId] = useState(technicians[0]?.id ?? "");
  const [dayJobs, setDayJobs] = useState<Job[]>([]);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const isAssignable = orderStatus === "paid" || orderStatus === "scheduled";

  useEffect(() => {
    if (!open || !date) return;
    let active = true;
    async function loadDayJobs() {
      setLoadingCounts(true);
      try {
        const response = await fetch(`/api/admin/jobs?date_from=${date}T00:00:00%2B09:00&date_to=${date}T23:59:59%2B09:00&limit=100`, { cache: "no-store" });
        const json = await response.json();
        if (active && response.ok) setDayJobs(json.data?.jobs ?? []);
      } catch {
        if (active) setDayJobs([]);
      } finally {
        if (active) setLoadingCounts(false);
      }
    }
    loadDayJobs();
    return () => {
      active = false;
    };
  }, [date, open]);

  const counts = useMemo(() => {
    const currentSlot = slotFromTime(time);
    const map = new Map<string, number>();
    for (const job of dayJobs) {
      if (!job.technician_id || job.status === "cancelled") continue;
      if (jobSlot(job) !== currentSlot) continue;
      map.set(job.technician_id, (map.get(job.technician_id) ?? 0) + 1);
    }
    return map;
  }, [dayJobs, time]);

  async function assign() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          technician_id: technicianId,
          scheduled_at: `${date}T${time}:00+09:00`
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "기사 배정에 실패했습니다.");
      setMessage(orderStatus === "scheduled" ? "기사 배정을 완료했습니다." : "기사 배정을 저장했습니다. 예약 확정 버튼으로 고객 안내를 확정해주세요.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "기사 배정을 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelJob(jobId: string) {
    if (!window.confirm("이 배정을 취소할까요? 주문 상태는 결제완료로 돌아갑니다.")) return;
    const response = await fetch(`/api/admin/jobs/${jobId}`, { method: "DELETE" });
    if (response.ok) window.location.reload();
    else setMessage("배정 취소에 실패했습니다.");
  }

  const assignedJobs = jobs.filter((job) => job.technician_id && job.status !== "cancelled");

  if (!isAssignable && assignedJobs.length === 0) {
    return compact ? null : <span className="adm-muted">배정 불가</span>;
  }

  return (
    <>
      <div className={compact ? "adm-inline-actions" : "adm-stack"}>
        {assignedJobs.map((job) => (
          <button key={job.id} className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={() => cancelJob(job.id)}>
            배정 취소
          </button>
        ))}
        {isAssignable && (
          <button className="adm-btn adm-btn-primary adm-btn-sm" type="button" onClick={() => setOpen(true)}>
            {orderStatus === "scheduled" ? "기사 재배정" : "기사 배정"}
          </button>
        )}
      </div>
      {open && (
        <div className="adm-modal-overlay" role="presentation" onMouseDown={() => setOpen(false)}>
          <div className="adm-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="adm-modal-header">
              <h2 className="adm-modal-title">기사 배정</h2>
            </div>
            <div className="adm-modal-body adm-stack">
              <p className="adm-muted">주문: {orderNumber} ({reservationLabel(date, time)})</p>
              {orderStatus !== "scheduled" && (
                <div className="adm-next-action">
                  <strong>운영 흐름</strong>
                  <p>이 단계는 기사만 배정합니다. 고객에게 방문 확정으로 보이게 하려면 주문 상세에서 예약 확정을 눌러주세요.</p>
                </div>
              )}
              <div className="adm-form-row adm-form-row-2">
                <label>
                  <span className="adm-label">방문 날짜</span>
                  <input className="adm-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </label>
                <label>
                  <span className="adm-label">방문 시간</span>
                  <input className="adm-input" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
                </label>
              </div>
              <div>
                <span className="adm-label">담당 기사 선택</span>
                <div className="adm-radio-stack">
                  {technicians.length === 0 && <p className="adm-muted">등록된 활성 기사가 없습니다. 기사 관리에서 먼저 추가해주세요.</p>}
                  {technicians.map((technician) => {
                    const assignedCount = counts.get(technician.id) ?? 0;
                    return (
                      <label key={technician.id} className={`adm-radio-row ${assignedCount > 0 ? "is-warn" : ""}`}>
                        <input type="radio" name="technician" value={technician.id} checked={technicianId === technician.id} onChange={() => setTechnicianId(technician.id)} />
                        <span>
                          {technician.name} {technician.region ? `(${technician.region})` : ""}
                          <small>{loadingCounts ? "배정 확인 중..." : `${date} ${slotFromTime(time) === "morning" ? "오전" : "오후"} 배정: ${assignedCount}건`}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {message && <p className="adm-form-message">{message}</p>}
            </div>
            <div className="adm-modal-footer">
              <button className="adm-btn adm-btn-secondary" type="button" onClick={() => setOpen(false)}>취소</button>
              <button className="adm-btn adm-btn-primary" type="button" disabled={!technicianId || saving} onClick={assign}>{saving ? "배정 중..." : orderStatus === "scheduled" ? "재배정 완료" : "배정 저장"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
