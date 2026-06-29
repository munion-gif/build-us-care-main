"use client";

import { useEffect, useMemo, useState } from "react";

type SlotPeriod = "morning" | "afternoon";
type SlotDayInfo = {
  date: string;
  blocked: boolean;
  beforeMinDate: boolean;
  allFull: boolean;
  slots: Record<SlotPeriod, { available: boolean; isFull?: boolean; usedCount?: number; maxCount?: number; used?: number; cap?: number }>;
};

type Props = {
  orderId: string;
  currentDate?: string | null;
  currentSlot?: SlotPeriod | null;
  hasActiveJob: boolean;
  localMode?: boolean;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function datePad(value: number) {
  return String(value).padStart(2, "0");
}

function localIsoDate(date: Date) {
  return `${date.getFullYear()}-${datePad(date.getMonth() + 1)}-${datePad(date.getDate())}`;
}

function monthFromDateText(dateText?: string | null) {
  if (dateText && /^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    const [year, month] = dateText.split("-").map(Number);
    return { year, month };
  }
  const date = new Date();
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function slotLabel(slot: SlotPeriod) {
  return slot === "afternoon" ? "오후" : "오전";
}

function slotUsageLabel(slot: SlotDayInfo["slots"][SlotPeriod] | undefined, label: string) {
  if (!slot) return `${label} 확인 중`;
  if (slot.available === false || slot.isFull) return `${label} 마감`;
  const used = slot.usedCount ?? slot.used ?? 0;
  const max = slot.maxCount ?? slot.cap ?? 0;
  return `${label} ${Math.min(used, max)}/${max}`;
}

export function OrderReservationEditPanel({ orderId, currentDate, currentSlot, hasActiveJob, localMode = false }: Props) {
  const [date, setDate] = useState(currentDate ?? "");
  const [slot, setSlot] = useState<SlotPeriod | "">(currentSlot ?? "");
  const [calendarMonth, setCalendarMonth] = useState(() => monthFromDateText(currentDate));
  const [slotDays, setSlotDays] = useState<Record<string, SlotDayInfo>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/slots?year=${calendarMonth.year}&month=${calendarMonth.month}&fresh=1`, { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        if (!cancelled) setSlotDays(json?.data?.days ?? {});
      })
      .catch(() => {
        if (!cancelled) setMessage("일정관리 슬롯을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [calendarMonth.month, calendarMonth.year]);

  const selectedDay = date ? slotDays[date] : null;
  const canSave = Boolean(date && slot && hasActiveJob && !localMode && !saving);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarMonth.year, calendarMonth.month - 1, 1).getDay();
    const daysInMonth = new Date(calendarMonth.year, calendarMonth.month, 0).getDate();
    const blanks = Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} className="adm-quote-calendar-blank" />);
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const dayDate = new Date(calendarMonth.year, calendarMonth.month - 1, index + 1);
      const iso = localIsoDate(dayDate);
      const dayInfo = slotDays[iso];
      const morning = dayInfo?.slots?.morning;
      const afternoon = dayInfo?.slots?.afternoon;
      const isCurrentDate = currentDate === iso;
      const unavailable = !isCurrentDate && (!dayInfo || dayInfo.blocked || dayInfo.beforeMinDate || dayInfo.allFull || (!morning?.available && !afternoon?.available));
      const label = !dayInfo
        ? "확인 중"
        : isCurrentDate
          ? "현재 일정"
          : dayInfo.beforeMinDate
            ? "준비 기간"
            : dayInfo.blocked
              ? "휴무"
              : dayInfo.allFull
                ? "마감"
                : `${slotUsageLabel(morning, "오전")} · ${slotUsageLabel(afternoon, "오후")}`;

      return (
        <button
          key={iso}
          type="button"
          className={[
            "adm-quote-calendar-day",
            dayDate.getDay() === 0 ? "sun" : "",
            dayDate.getDay() === 6 ? "sat" : "",
            date === iso ? "selected" : "",
            unavailable ? "disabled" : ""
          ].filter(Boolean).join(" ")}
          disabled={saving || unavailable}
          onClick={() => {
            setDate(iso);
            if (slot && !isCurrentDate && !dayInfo?.slots?.[slot]?.available) setSlot("");
          }}
        >
          <strong>{index + 1}</strong>
          <small>{label}</small>
        </button>
      );
    });
    return [...blanks, ...days];
  }, [calendarMonth.month, calendarMonth.year, currentDate, date, saving, slot, slotDays]);

  function moveMonth(offset: number) {
    setCalendarMonth((current) => {
      const next = new Date(current.year, current.month - 1 + offset, 1);
      return { year: next.getFullYear(), month: next.getMonth() + 1 };
    });
  }

  async function saveSchedule() {
    if (localMode) {
      setMessage("로컬 확인 모드에서는 방문 일정을 수정하지 않습니다.");
      return;
    }
    if (!hasActiveJob) {
      setMessage("방문 일정을 수정하려면 먼저 기사 배정을 저장해야 합니다.");
      return;
    }
    if (!date || !slot) {
      setMessage("방문 날짜와 시간대를 선택하세요.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation: { reserved_date: date, time_slot: slot } })
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error?.message ?? "방문 일정 수정에 실패했습니다.");
      setMessage("방문 일정을 수정했습니다.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "방문 일정 수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="adm-card adm-quote-schedule-card">
      <div className="adm-section-head">
        <div>
          <h2 className="adm-card-title">방문 일정 수정</h2>
          <p className="adm-muted">제품 주문으로 전환된 뒤의 실제 방문 일정은 이 주문 상세에서 관리합니다.</p>
        </div>
        {loading ? <span className="adm-badge adm-badge-gray">슬롯 확인 중</span> : null}
      </div>
      {!hasActiveJob ? (
        <p className="adm-form-message adm-form-message-error">방문 일정을 수정하려면 먼저 기사 배정이 필요합니다.</p>
      ) : null}
      <div className="adm-quote-calendar-head">
        <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={() => moveMonth(-1)} disabled={saving}>이전</button>
        <strong>{calendarMonth.year}년 {calendarMonth.month}월</strong>
        <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={() => moveMonth(1)} disabled={saving}>다음</button>
      </div>
      <div className={`adm-quote-calendar ${loading ? "loading" : ""}`}>
        {WEEKDAYS.map((weekday, index) => (
          <span key={weekday} className={`adm-quote-calendar-weekday${index === 0 ? " sun" : index === 6 ? " sat" : ""}`}>{weekday}</span>
        ))}
        {calendarDays}
      </div>
      <div>
        <span className="adm-label">시간대</span>
        <div className="adm-quote-slot-actions">
          {(["morning", "afternoon"] as const).map((period) => {
            const isCurrentSlot = currentDate === date && currentSlot === period;
            const available = Boolean(date && (isCurrentSlot || !selectedDay || selectedDay.slots[period]?.available));
            return (
              <button
                key={period}
                type="button"
                className={`adm-btn ${slot === period ? "adm-btn-primary" : "adm-btn-secondary"}`}
                onClick={() => setSlot(period)}
                disabled={saving || !date || !available}
              >
                {slotLabel(period)}{date && !available ? " · 마감" : ""}
              </button>
            );
          })}
        </div>
      </div>
      <div className="adm-inline-actions">
        <button className="adm-btn adm-btn-primary" type="button" onClick={saveSchedule} disabled={!canSave}>
          {saving ? "저장 중..." : localMode ? "로컬에서 수정 불가" : "방문 일정 저장"}
        </button>
        <a className="adm-btn adm-btn-secondary" href="/admin/slots" target="_blank" rel="noreferrer">일정관리 열기</a>
      </div>
      {message ? <p className="adm-form-message">{message}</p> : null}
    </section>
  );
}
