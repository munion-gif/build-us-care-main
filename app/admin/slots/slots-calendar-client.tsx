"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type SlotInfo = { used?: number; cap?: number; isFull?: boolean; available?: boolean };
type SlotDay = { blocked?: boolean; beforeMinDate?: boolean; allFull?: boolean; slots?: { morning?: SlotInfo; afternoon?: SlotInfo } };
type Visit = { slot: "morning" | "afternoon"; name: string; detail: string };

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function one(v: any): any {
  return Array.isArray(v) ? v[0] : v;
}
function slotFromAt(value?: string | null): "morning" | "afternoon" | null {
  if (!value) return null;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(new Date(value)));
  return hour < 13 ? "morning" : "afternoon";
}
function kstDay(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

const SAMPLE_VISITS: Record<string, Visit[]> = {};

export function SlotsCalendar({ localMode = false }: { localMode?: boolean }) {
  const today = new Date();
  const [cal, setCal] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const [slotDays, setSlotDays] = useState<Record<string, SlotDay>>({});
  const [visits, setVisits] = useState<Record<string, Visit[]>>({});
  const [sel, setSel] = useState<string>(iso(today.getFullYear(), today.getMonth() + 1, today.getDate()));
  const [msg, setMsg] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const daysInMonth = new Date(cal.year, cal.month, 0).getDate();

  useEffect(() => {
    let cancelled = false;
    const start = iso(cal.year, cal.month, 1);
    const end = iso(cal.year, cal.month, daysInMonth);
    Promise.all([
      fetch(`/api/slots?year=${cal.year}&month=${cal.month}&fresh=1`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/admin/jobs?date_from=${start}T00:00:00%2B09:00&date_to=${end}T23:59:59%2B09:00&limit=100`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}))
    ]).then(([slotRes, jobRes]) => {
      if (cancelled) return;
      setSlotDays(slotRes?.data?.days ?? {});
      const rawJobs = Array.isArray(jobRes) ? jobRes : jobRes?.data?.jobs ?? jobRes?.data ?? jobRes?.jobs ?? [];
      const map: Record<string, Visit[]> = {};
      for (const job of rawJobs) {
        if (!job?.scheduled_at || job.status === "cancelled") continue;
        const day = kstDay(job.scheduled_at);
        const slot = slotFromAt(job.scheduled_at);
        if (!slot) continue;
        const cust = one(job.customers) ?? one(job.orders?.customers);
        const tech = one(job.technicians);
        const name = cust?.name ?? job.customer_name ?? "고객";
        const detail = [tech?.name ? `기사 ${tech.name}` : "", cust?.phone ?? job.customer_phone ?? ""].filter(Boolean).join(" · ") || "방문 예정";
        (map[day] ??= []).push({ slot, name, detail });
      }
      setVisits(Object.keys(map).length ? map : localMode ? SAMPLE_VISITS : {});
    });
    return () => { cancelled = true; };
  }, [cal.year, cal.month, daysInMonth, localMode, reloadKey]);

  const cap = useMemo(() => {
    const d = Object.values(slotDays)[0];
    return { am: d?.slots?.morning?.cap ?? 3, pm: d?.slots?.afternoon?.cap ?? 3 };
  }, [slotDays]);

  const weekVisitCount = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7));
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const dt = new Date(monday); dt.setDate(monday.getDate() + i);
      n += (visits[iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())] ?? []).length;
    }
    return n;
  }, [visits]);

  function move(delta: number) {
    setCal((c) => {
      const d = new Date(c.year, c.month - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  }

  async function toggleBlock() {
    if (localMode) { setMsg("미리보기 모드 — 실제 휴무 처리는 프로덕션에서 됩니다."); return; }
    const blocked = slotDays[sel]?.blocked;
    try {
      const res = blocked
        ? await fetch(`/api/admin/slot-configs/${sel}`, { method: "DELETE" })
        : await fetch("/api/admin/slot-configs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: sel, reason: "관리자 차단" }) });
      if (res.ok) { setMsg(blocked ? "휴무를 해제했어요." : "이 날짜를 휴무로 막았어요."); setReloadKey((k) => k + 1); }
      else setMsg("변경하지 못했어요.");
    } catch { setMsg("처리 중 오류가 생겼어요."); }
  }

  const firstDay = new Date(cal.year, cal.month - 1, 1).getDay();
  const selVisits = (visits[sel] ?? []).sort((a, b) => (a.slot === b.slot ? 0 : a.slot === "morning" ? -1 : 1));
  const selDow = (() => { const d = new Date(sel); return DOW[d.getDay()]; })();

  function availText(day: SlotDay | undefined): { text: string; cls: string } {
    if (!day) return { text: "", cls: "" };
    if (day.beforeMinDate) return { text: "준비", cls: "mut" };
    if (day.blocked) return { text: "휴무", cls: "blk" };
    if (day.allFull || (!day.slots?.morning?.available && !day.slots?.afternoon?.available)) return { text: "마감", cls: "full" };
    const leftM = Math.max(0, (day.slots?.morning?.cap ?? 0) - (day.slots?.morning?.used ?? 0));
    const leftP = Math.max(0, (day.slots?.afternoon?.cap ?? 0) - (day.slots?.afternoon?.used ?? 0));
    const left = leftM + leftP;
    return { text: left <= 1 ? "1자리" : "여유", cls: "ok" };
  }

  return (
    <div className="sch">
      <style>{SCH_CSS}</style>
      <div className="ph">
        <div><h1>일정</h1><div className="sub">관리자가 잡은 일정 = builduscare.co.kr 예약 달력에 자동 반영</div></div>
        <div className="chip">이번 주 방문 <b className="num">{weekVisitCount}건</b></div>
      </div>

      {localMode ? <div className="sch-note">지금은 <b>미리보기(로컬)</b>예요. 슬롯 가용성은 실제 계산이고, 방문 목록은 프로덕션에서 보여요.</div> : null}

      <div className="caltop">
        <div className="calwrap">
          <div className="calnav">
            <div className="mo">{cal.year}년 {cal.month}월</div>
            <div className="right">
              <span className="cap">하루 방문 <b className="num">오전 {cap.am}·오후 {cap.pm}</b></span>
              <div className="btns"><button onClick={() => move(-1)}>‹</button><button onClick={() => move(1)}>›</button></div>
            </div>
          </div>
          <div className="cal">
            {WD.map((w, i) => <div key={w} className={`dow ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}>{w}</div>)}
            {Array.from({ length: firstDay }, (_, i) => <div key={`b${i}`} className="cell mutcell" />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1;
              const key = iso(cal.year, cal.month, d);
              const day = slotDays[key];
              const av = availText(day);
              const vs = visits[key] ?? [];
              return (
                <button key={key} className={`cell ${av.cls} ${sel === key ? "sel" : ""}`} onClick={() => setSel(key)}>
                  <span className="dn">{d}</span>
                  {av.text ? <span className="av">{av.text}</span> : null}
                  {vs.length ? <span className="vdot">{vs.length}</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="sidep">
          <b className="sd">{cal.month}/{Number(sel.slice(8))} ({selDow}) 방문</b>
          <div className="vlist">
            {selVisits.length ? selVisits.map((v, i) => (
              <div className="visit" key={i}>
                <span className="vt">{v.slot === "morning" ? "오전" : "오후"}</span>
                <div><div className="vn">{v.name}</div><div className="vd">{v.detail}</div></div>
              </div>
            )) : <div className="vempty">이 날은 예약된 방문이 없어요.</div>}
          </div>
          <div className="syncbar">🔗 여기서 확정한 일정은 공개 예약 달력에서 <b>실시간 마감</b>돼요.</div>
          <button className="blkbtn" onClick={toggleBlock}>{slotDays[sel]?.blocked ? "휴무 해제하기" : "이 날짜 휴무로 막기"}</button>
          {msg ? <div className="sch-msg">{msg}</div> : null}
          <Link href="/admin/slots/manage" className="managelink">상세 일정관리 (날짜별 cap·차단) →</Link>
        </aside>
      </div>
    </div>
  );
}

const SCH_CSS = `
.sch { --surface:#fff; --surface-2:#f2f4f7; --surface-3:#f2f4f7; --text:#101828; --text-muted:#667085; --text-faint:#98a2b3; --border:#e5e7eb; --accent:#245fff; --accent-soft:#eff4ff; --accent-text:#1647d7; --green:#178a4c; --green-soft:#e6f6ec; --amber:#b7791f; --red:#cf3838; --red-soft:#fdeceb; color:var(--text); padding: 26px clamp(16px, 2.4vw, 34px) 48px; }
.sch .num { font-variant-numeric: tabular-nums; }
.sch .ph { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.sch .ph h1 { font-size: 23px; font-weight: 800; letter-spacing: -0.03em; margin: 0; }
.sch .ph .sub { color: var(--text-muted); font-size: 13.5px; margin-top: 5px; }
.sch .chip { background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 9px 15px; font-size: 13px; font-weight: 700; }
.sch .chip b { color: var(--accent-text); }
.sch-note { background: #eef3ff; border: 1px solid #cddbff; color: #244a9c; border-radius: 12px; padding: 12px 16px; font-size: 13px; margin-bottom: 16px; }
.caltop { display: grid; grid-template-columns: 1fr 300px; gap: 16px; align-items: start; }
.calwrap { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 18px; }
.calnav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.calnav .mo { font-size: 17px; font-weight: 800; }
.calnav .right { display: flex; align-items: center; gap: 14px; }
.calnav .cap { font-size: 11.5px; color: var(--text-faint); }
.calnav .cap b { color: var(--text); }
.calnav .btns { display: flex; gap: 6px; }
.calnav .btns button { width: 30px; height: 30px; border: 1px solid var(--border); background: var(--surface); border-radius: 8px; cursor: pointer; color: var(--text-muted); font-size: 16px; }
.cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
.cal .dow { text-align: center; font-size: 11px; color: var(--text-faint); font-weight: 800; padding-bottom: 4px; }
.cal .dow.sun { color: var(--red); } .cal .dow.sat { color: var(--accent); }
.cell { min-height: 62px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface-2); display: flex; flex-direction: column; align-items: flex-start; padding: 7px 9px; gap: 3px; cursor: pointer; position: relative; }
.cell.mutcell { background: transparent; border-color: transparent; cursor: default; }
.cell .dn { font-size: 13px; font-weight: 800; }
.cell .av { font-size: 9.5px; font-weight: 800; }
.cell.ok .av { color: var(--green); }
.cell.full { background: var(--surface-3); color: var(--text-faint); }
.cell.full .av { color: var(--text-faint); }
.cell.blk { background: var(--red-soft); }
.cell.blk .av { color: var(--red); }
.cell.mut .av { color: var(--text-faint); }
.cell.sel { background: var(--accent); color: #fff; border-color: var(--accent); }
.cell.sel .av { color: #dbe6ff; }
.cell .vdot { position: absolute; top: 6px; right: 7px; background: var(--accent); color: #fff; font-size: 9.5px; font-weight: 800; min-width: 16px; height: 16px; border-radius: 999px; display: grid; place-items: center; padding: 0 4px; }
.cell.sel .vdot { background: #fff; color: var(--accent); }
.sidep { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 18px; }
.sidep .sd { font-size: 14px; font-weight: 800; }
.vlist { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.visit { display: flex; gap: 10px; align-items: flex-start; padding: 10px; background: var(--surface-2); border-radius: 11px; }
.visit .vt { background: var(--accent-soft); color: var(--accent-text); font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 7px; white-space: nowrap; }
.visit .vn { font-weight: 800; font-size: 13.5px; }
.visit .vd { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.vempty { padding: 20px 0; text-align: center; color: var(--text-faint); font-size: 13px; }
.syncbar { margin-top: 14px; font-size: 12px; color: var(--green); background: var(--green-soft); padding: 10px 12px; border-radius: 10px; line-height: 1.5; font-weight: 700; }
.blkbtn { width: 100%; margin-top: 12px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-muted); font-weight: 800; font-size: 13px; padding: 11px; border-radius: 11px; cursor: pointer; }
.blkbtn:hover { border-color: var(--red); color: var(--red); }
.sch-msg { margin-top: 10px; font-size: 12.5px; color: var(--accent-text); }
.managelink { display: block; margin-top: 14px; font-size: 12.5px; color: var(--text-faint); text-decoration: none; }
.managelink:hover { color: var(--accent-text); }
@media (max-width: 900px) { .caltop { grid-template-columns: 1fr; } }
`;
