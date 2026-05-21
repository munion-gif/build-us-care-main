"use client";

import { useEffect, useMemo, useState } from "react";

type SlotPeriod = "morning" | "afternoon";
type SlotDay = {
  date: string;
  allFull: boolean;
  blocked: boolean;
  beforeMinDate: boolean;
  slots: Record<SlotPeriod, { isFull: boolean; usedCount: number; maxCount: number }>;
};
type AdminJob = {
  id: string;
  status?: string | null;
  scheduled_at?: string | null;
  technicians?: { name?: string | null } | null;
  orders?: { id?: string | null; order_number?: string | null; homes?: { address_full?: string | null } | null } | null;
};

function monthLabel(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function kstDateOnly(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function kstSlot(value?: string | null): SlotPeriod | null {
  if (!value) return null;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(new Date(value)));
  return hour < 13 ? "morning" : "afternoon";
}

function kstTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

export function AdminSlotsClient() {
  const [month, setMonth] = useState(() => new Date());
  const [days, setDays] = useState<Record<string, SlotDay>>({});
  const [cap, setCap] = useState(3);
  const [draftCap, setDraftCap] = useState("");
  const [capSource, setCapSource] = useState("active_technicians");
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const calendarDays = useMemo(() => buildCalendarDays(month), [month]);

  async function loadSlots(target = month) {
    const start = performance.now();
    setLoading(true);
    setMessage("");
    try {
      const startDate = toIsoDate(new Date(target.getFullYear(), target.getMonth(), 1));
      const endDate = toIsoDate(new Date(target.getFullYear(), target.getMonth() + 1, 1));
      const [slotsResponse, configResponse, jobsResponse] = await Promise.all([
        fetch(`/api/slots?year=${target.getFullYear()}&month=${target.getMonth() + 1}`),
        fetch("/api/admin/slot-configs"),
        fetch(`/api/admin/jobs?date_from=${startDate}T00:00:00%2B09:00&date_to=${endDate}T00:00:00%2B09:00&limit=100`, { cache: "no-store" })
      ]);
      const slotsJson = await slotsResponse.json();
      const configJson = await configResponse.json();
      const jobsJson = await jobsResponse.json();
      if (!slotsResponse.ok || !slotsJson.ok) throw new Error("슬롯 현황을 불러오지 못했습니다.");
      if (!configResponse.ok || !configJson.ok) throw new Error("슬롯 설정을 불러오지 못했습니다.");
      setDays(slotsJson.data?.days ?? {});
      const nextCap = Number(configJson.data?.cap ?? slotsJson.data?.effectiveMaxSlotsPerPeriod ?? 3);
      setCap(nextCap);
      setCapSource(configJson.data?.capSource ?? slotsJson.data?.capSource ?? "fallback");
      setDraftCap(configJson.data?.capSource === "manual" ? String(nextCap) : "");
      setJobs(jobsResponse.ok ? jobsJson.data?.jobs ?? [] : []);
    } catch (error) {
      setDays({});
      setJobs([]);
      setMessage(error instanceof Error ? error.message : "슬롯 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      console.log(`[perf] admin.slots.loadSlots: ${Math.round(performance.now() - start)}ms`);
    }
  }

  useEffect(() => {
    void loadSlots(month);
  }, [month]);

  function moveMonth(offset: number) {
    setDays({});
    setLoading(true);
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  async function toggleBlock(dateText: string) {
    const day = days[dateText];
    setMessage("");
    const response = day?.blocked
      ? await fetch(`/api/admin/slot-configs/${dateText}`, { method: "DELETE" })
      : await fetch("/api/admin/slot-configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dateText, reason: "관리자 차단" })
        });
    if (!response.ok) {
      setMessage("차단 상태를 변경하지 못했습니다.");
      return;
    }
    await loadSlots(month);
  }

  async function saveCap() {
    setMessage("");
    const nextCap = draftCap.trim() === "" ? 0 : Number(draftCap);
    if (!Number.isFinite(nextCap) || nextCap < 0) {
      setMessage("cap은 0 이상 숫자로 입력해주세요.");
      return;
    }
    const response = await fetch("/api/admin/slot-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "cap", cap_value: nextCap })
    });
    if (!response.ok) {
      setMessage("전체 cap을 저장하지 못했습니다.");
      return;
    }
    await loadSlots(month);
    setMessage(nextCap > 0 ? "전체 cap을 저장했습니다." : "활성 기사 수 기준 자동 설정으로 전환했습니다.");
  }

  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, Record<SlotPeriod, AdminJob[]>>();
    for (const job of jobs) {
      if (!job.scheduled_at || job.status === "cancelled") continue;
      const day = kstDateOnly(job.scheduled_at);
      const slot = kstSlot(job.scheduled_at);
      if (!slot) continue;
      if (!map.has(day)) map.set(day, { morning: [], afternoon: [] });
      map.get(day)![slot].push(job);
    }
    return map;
  }, [jobs]);

  const selectedAssignments = selectedDate ? assignmentsByDate.get(selectedDate) : null;

  return (
    <div className="adm-content">
      <section className="adm-card adm-section adm-slot-controls">
        <div>
          <h2 className="adm-section-title">전체 예약 cap</h2>
          <p className="adm-muted">날짜별 설정이 없으면 오전/오후 각각 이 값을 사용합니다. 현재 {cap}건입니다. ({capSource === "manual" ? "수동 설정" : capSource === "active_technicians" ? "활성 기사 수 자동 연동" : "기본값"})</p>
        </div>
        <label className="adm-slot-cap">
          <span>슬롯당 최대 건수</span>
          <input className="adm-input" type="number" min={0} max={20} value={draftCap} placeholder="자동" onChange={(event) => setDraftCap(event.target.value)} />
        </label>
        <button className="adm-btn adm-btn-primary" type="button" onClick={saveCap}>
          저장
        </button>
      </section>

      <section className="adm-card adm-section">
        <div className="adm-slot-header">
          <button className="adm-btn adm-btn-secondary" type="button" onClick={() => moveMonth(-1)}>
            이전 달
          </button>
          <strong>{monthLabel(month)}</strong>
          <button className="adm-btn adm-btn-secondary" type="button" onClick={() => moveMonth(1)}>
            다음 달
          </button>
        </div>
        {message && <p className="adm-slot-message">{message}</p>}
        <div className="adm-slot-weekdays">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="adm-slot-calendar" aria-busy={loading}>
          {calendarDays.map((date) => {
            const iso = toIsoDate(date);
            const day = days[iso];
            const outside = date.getMonth() !== month.getMonth();
            const morning = day?.slots.morning;
            const afternoon = day?.slots.afternoon;
            const assignments = assignmentsByDate.get(iso);
            const morningNames = (assignments?.morning ?? []).map((job) => job.technicians?.name).filter(Boolean).join(", ");
            const afternoonNames = (assignments?.afternoon ?? []).map((job) => job.technicians?.name).filter(Boolean).join(", ");
            return (
              <button
                key={iso}
                type="button"
                className={[outside ? "outside" : "", day?.blocked ? "blocked" : "", day?.allFull ? "full" : "", loading ? "loading" : ""]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => !loading && !outside && setSelectedDate(iso)}
              >
                <strong>{date.getDate()}</strong>
                {loading ? (
                  <span className="adm-slot-skeleton" />
                ) : day ? (
                  <>
                    <span className={morning?.isFull ? "danger" : "ok"}>오전 {morning?.usedCount ?? 0}/{morning?.maxCount ?? cap}</span>
                    {morningNames && <small>{morningNames}</small>}
                    <span className={afternoon?.isFull ? "danger" : "ok"}>오후 {afternoon?.usedCount ?? 0}/{afternoon?.maxCount ?? cap}</span>
                    {afternoonNames && <small>{afternoonNames}</small>}
                    {day.blocked && <em>차단</em>}
                  </>
                ) : (
                  <span className="adm-muted">-</span>
                )}
              </button>
            );
          })}
        </div>
      </section>
      {selectedDate && days[selectedDate] && (
        <section className="adm-card adm-section">
          <div className="adm-slot-panel-head">
            <div>
              <h2 className="adm-section-title">{selectedDate} 배정 현황</h2>
              <p className="adm-muted">현재 cap {cap}건 기준으로 남은 슬롯을 확인합니다.</p>
            </div>
            <button className={`adm-btn ${days[selectedDate].blocked ? "adm-btn-secondary" : "adm-btn-danger"}`} type="button" onClick={() => void toggleBlock(selectedDate)}>
              {days[selectedDate].blocked ? "차단 해제" : "날짜 차단"}
            </button>
          </div>
          {(["morning", "afternoon"] as const).map((period) => {
            const periodJobs = selectedAssignments?.[period] ?? [];
            const remaining = Math.max(0, (days[selectedDate].slots[period].maxCount ?? cap) - periodJobs.length);
            return (
              <div className="adm-slot-panel-section" key={period}>
                <h3>{period === "morning" ? "오전" : "오후"}</h3>
                {periodJobs.map((job) => (
                  <p key={job.id}>✅ {job.orders?.order_number ?? "주문"} | {job.technicians?.name ?? "미배정"} | {kstTime(job.scheduled_at)}</p>
                ))}
                {Array.from({ length: remaining }, (_, index) => (
                  <p key={`${period}-empty-${index}`}>○ 미배정 슬롯 {index + 1}개 남음</p>
                ))}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
