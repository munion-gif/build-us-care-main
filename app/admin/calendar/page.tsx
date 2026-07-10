"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch, getCache, setCache, useToast } from "../_lib/ui";
import { KR_HOLIDAYS } from "../_lib/holidays";
import { AdminOrderRow, orderJob, orderStage, orderItemsSummary, shortRegion } from "../_lib/orders-shared";

const pad2 = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

type SlotsData = {
  effectiveMaxSlotsPerPeriod: number;
  capSource: string;
  activeTechnicianCount: number;
  slots: Record<string, string[]>;
};

type SlotConfig = { date?: string; target_date?: string; blocked?: boolean; reason?: string | null; type?: string };

export default function AdminCalendarPage() {
  const router = useRouter();
  const toast = useToast();
  const now = new Date();
  const [calY, setCalY] = useState(now.getFullYear());
  const [calM, setCalM] = useState(now.getMonth());
  const [slots, setSlots] = useState<SlotsData | null>(() => getCache<SlotsData>(`slots:${now.getFullYear()}-${now.getMonth()}`) ?? null);
  const [configs, setConfigs] = useState<SlotConfig[]>(() => getCache<SlotConfig[]>("slot-configs") ?? []);
  const [orders, setOrders] = useState<AdminOrderRow[]>(() => getCache<AdminOrderRow[]>("orders") ?? []);
  const [busyDate, setBusyDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [slotRes, cfgRes, ordRes] = await Promise.all([
      adminFetch<SlotsData>(`/api/slots?year=${calY}&month=${calM + 1}`),
      adminFetch<{ configs: SlotConfig[] }>("/api/admin/slot-configs"),
      adminFetch<{ orders: AdminOrderRow[] }>("/api/admin/orders?limit=100")
    ]);
    if (slotRes.ok && slotRes.data) {
      setSlots(slotRes.data);
      setCache(`slots:${calY}-${calM}`, slotRes.data);
    }
    if (cfgRes.ok && cfgRes.data) {
      setConfigs(cfgRes.data.configs ?? []);
      setCache("slot-configs", cfgRes.data.configs ?? []);
    }
    if (ordRes.ok && ordRes.data) {
      const rows = (ordRes.data.orders ?? []).filter((x) => !x.deleted_at && !x.is_test);
      setOrders(rows);
      setCache("orders", rows);
    }
  }, [calY, calM]);

  useEffect(() => {
    load();
  }, [load]);

  const blockedDates = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of configs) {
      const date = c.target_date ?? c.date;
      if (date && c.blocked) map.set(date, c.reason ?? "관리자 차단");
    }
    return map;
  }, [configs]);

  const events = useMemo(() => {
    const map = new Map<string, Array<{ id: string; who: string; tm: string; cls: string }>>();
    for (const o of orders) {
      const job = orderJob(o);
      const stage = orderStage(o);
      if (!job?.scheduled_at) continue;
      const d = new Date(job.scheduled_at);
      const k = keyOf(d.getFullYear(), d.getMonth(), d.getDate());
      const period = d.getHours() < 12 ? "오전" : "오후";
      let cls = period === "오전" ? "ev-am" : "ev-pm";
      if (stage === "done") cls = "ev-done";
      if (stage === "pay" || stage === "quote") cls = "ev-wait";
      if (stage === "cancel") continue;
      const arr = map.get(k) ?? [];
      arr.push({
        id: o.id,
        who: `${o.customers?.name ?? "고객"} · ${orderItemsSummary(o)}`,
        tm: `${period} · ${shortRegion(o.homes?.address_full).split(" ").slice(-1)[0] ?? ""}${stage === "done" ? " · 완료" : ""}${stage === "pay" ? " · 입금 대기" : ""}`,
        cls
      });
      map.set(k, arr);
    }
    return map;
  }, [orders]);

  async function toggleBlock(dateKey: string, isBlocked: boolean) {
    setBusyDate(dateKey);
    const res = isBlocked
      ? await adminFetch(`/api/admin/slot-configs/${dateKey}`, { method: "DELETE" })
      : await adminFetch("/api/admin/slot-configs", {
          method: "POST",
          body: JSON.stringify({ date: dateKey, reason: "관리자 차단" })
        });
    setBusyDate(null);
    if (!res.ok) {
      toast(res.message ?? "변경에 실패했어요", "err");
      return;
    }
    toast(
      isBlocked
        ? `${dateKey} 예약을 다시 열었어요 — 홈페이지 예약 달력에 바로 반영됩니다`
        : `${dateKey} 예약을 마감했어요 — 홈페이지 예약 달력에 바로 반영됩니다`
    );
    load();
  }

  const first = new Date(calY, calM, 1);
  const start = new Date(calY, calM, 1 - first.getDay());
  const cells: Array<{ dt: Date; out: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ dt, out: dt.getMonth() !== calM });
  }
  const trimmed = cells.slice(35).every((c) => c.out) ? cells.slice(0, 35) : cells;
  const todayKey = keyOf(now.getFullYear(), now.getMonth(), now.getDate());
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cap = slots?.effectiveMaxSlotsPerPeriod ?? 0;

  return (
    <>
      <h1>예약 캘린더</h1>
      <p className="h-sub">
        한 달 방문 일정을 한눈에. 일정을 누르면 해당 주문이 열리고, 공휴일은 빨간색으로 표시돼요.
        <span className="sync-badge">
          <span className="sync-dot" />
          홈페이지 예약 달력과 실시간 연동 — 여기서 마감하면 고객 예약 화면에서도 바로 닫혀요
        </span>
      </p>
      <div className="cal-head">
        <button
          className="btn"
          aria-label="이전 달"
          onClick={() => {
            const m = calM - 1;
            if (m < 0) {
              setCalM(11);
              setCalY(calY - 1);
            } else setCalM(m);
          }}
        >
          ←
        </button>
        <span className="wk">
          {calY}년 {calM + 1}월
        </span>
        <button
          className="btn"
          aria-label="다음 달"
          onClick={() => {
            const m = calM + 1;
            if (m > 11) {
              setCalM(0);
              setCalY(calY + 1);
            } else setCalM(m);
          }}
        >
          →
        </button>
        <button
          className="btn"
          onClick={() => {
            setCalY(now.getFullYear());
            setCalM(now.getMonth());
          }}
        >
          오늘
        </button>
        <span className="sp" />
        <div className="cal-legend">
          <span className="lg">
            <span className="sw" style={{ background: "var(--info-soft)", border: "1px solid var(--info)" }} />
            오전 방문
          </span>
          <span className="lg">
            <span className="sw" style={{ background: "var(--good-soft)", border: "1px solid var(--good)" }} />
            오후 방문
          </span>
          <span className="lg">
            <span className="sw" style={{ background: "var(--warn-soft)", border: "1px solid var(--warn)" }} />
            입금 대기
          </span>
          <span className="lg">
            <span className="sw" style={{ background: "var(--line-2)", border: "1px solid var(--ink-3)" }} />
            완료
          </span>
          <span className="lg" style={{ color: "var(--ink-3)" }}>
            시간대당 최대 {cap}건 (활성 기사 {slots?.activeTechnicianCount ?? 0}명 기준)
          </span>
        </div>
      </div>
      <div className="cal-dow">
        <span>일</span>
        <span>월</span>
        <span>화</span>
        <span>수</span>
        <span>목</span>
        <span>금</span>
        <span>토</span>
      </div>
      <div className="cal">
        {trimmed.map(({ dt, out }) => {
          const y = dt.getFullYear();
          const m = dt.getMonth();
          const d = dt.getDate();
          const dow = dt.getDay();
          const k = keyOf(y, m, d);
          const isToday = k === todayKey;
          const hol = KR_HOLIDAYS[k];
          const numCls = hol || dow === 0 ? "sun" : dow === 6 ? "sat" : "";
          const dayEvents = events.get(k) ?? [];
          const isFuture = dt >= startToday;
          const blocked = blockedDates.get(k);
          const available = slots?.slots?.[k] ?? [];
          let slotEl: React.ReactNode = null;
          if (!out && isFuture && !hol && dow !== 0) {
            if (blocked) {
              slotEl = <div className="slot-left blocked">예약 마감 · {blocked}</div>;
            } else if (available.length === 0) {
              slotEl = <div className="slot-left full">예약 마감</div>;
            } else {
              slotEl = (
                <div className="slot-left">
                  예약 가능 {available.map((p) => (p === "morning" ? "오전" : "오후")).join(" · ")}
                </div>
              );
            }
          }
          return (
            <div key={k} className={`day ${out ? "out" : ""} ${isToday ? "today-d" : ""}`}>
              <div className="d-t">
                <span className={`num ${numCls}`}>{d}</span>
                {hol ? (
                  <span className="hol" title={hol}>
                    {hol}
                  </span>
                ) : null}
                {isToday ? <span className="today-tag">오늘</span> : null}
                {!out && isFuture && !hol && dow !== 0 ? (
                  <button
                    className="btn"
                    style={{ marginLeft: "auto", padding: "0 6px", fontSize: 10.5, lineHeight: "16px" }}
                    disabled={busyDate === k}
                    onClick={() => toggleBlock(k, Boolean(blocked))}
                    title={blocked ? "예약 다시 열기" : "이 날짜 예약 마감"}
                  >
                    {blocked ? "열기" : "마감"}
                  </button>
                ) : null}
              </div>
              {dayEvents.map((ev) => (
                <button key={ev.id} className={`ev-chip ${ev.cls}`} onClick={() => router.push(`/admin/orders?open=${ev.id}`)}>
                  <b>{ev.who}</b>
                  <span className="tm">{ev.tm}</span>
                </button>
              ))}
              {slotEl}
            </div>
          );
        })}
      </div>
    </>
  );
}
