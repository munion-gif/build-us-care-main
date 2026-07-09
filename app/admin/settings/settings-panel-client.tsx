"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Tech = { id: string; name: string; is_active: boolean; weekCount?: number };

export function SettingsPanel({ localMode = false }: { localMode?: boolean }) {
  const [cap, setCap] = useState<number>(3);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [autos, setAutos] = useState<Record<string, boolean>>({ intake: true, quote: true, remind: true, review: false });
  const [msg, setMsg] = useState<string | null>(null);

  function flash(m: string) {
    setMsg(m);
    window.setTimeout(() => setMsg((c) => (c === m ? null : c)), 2200);
  }

  useEffect(() => {
    const now = new Date();
    fetch(`/api/slots?year=${now.getFullYear()}&month=${now.getMonth() + 1}&fresh=1`, { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => {
        const day: any = Object.values(res?.data?.days ?? {})[0];
        if (day?.slots?.morning?.cap) setCap(Number(day.slots.morning.cap));
      })
      .catch(() => {});
    fetch("/api/admin/technicians", { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => {
        const list = res?.data?.technicians ?? res?.technicians ?? res?.data ?? [];
        if (Array.isArray(list) && list.length) {
          setTechs(list.map((t: any) => ({ id: String(t.id), name: t.name ?? "기사", is_active: t.is_active !== false })));
        } else if (localMode) {
          setTechs([
            { id: "t1", name: "정현우", is_active: true, weekCount: 5 },
            { id: "t2", name: "김태호", is_active: true, weekCount: 3 },
            { id: "t3", name: "이상민", is_active: false }
          ]);
        }
      })
      .catch(() => {
        if (localMode) setTechs([{ id: "t1", name: "정현우", is_active: true, weekCount: 5 }, { id: "t2", name: "김태호", is_active: true, weekCount: 3 }, { id: "t3", name: "이상민", is_active: false }]);
      });
  }, [localMode]);

  async function changeCap(delta: number) {
    const next = Math.max(0, cap + delta);
    setCap(next);
    if (localMode) { flash("미리보기 모드 — 실제 저장은 프로덕션에서 됩니다."); return; }
    try {
      const res = await fetch("/api/admin/slot-configs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "cap", cap_value: next }) });
      flash(res.ok ? "하루 방문 가능 건수를 바꿨어요." : "저장하지 못했어요.");
    } catch { flash("처리 중 오류가 생겼어요."); }
  }

  async function toggleTech(t: Tech) {
    const next = !t.is_active;
    setTechs((cur) => cur.map((x) => (x.id === t.id ? { ...x, is_active: next } : x)));
    if (localMode) { flash("미리보기 모드 — 실제 저장은 프로덕션에서 됩니다."); return; }
    try {
      const res = await fetch("/api/admin/technicians", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, is_active: next }) });
      if (!res.ok) { setTechs((cur) => cur.map((x) => (x.id === t.id ? { ...x, is_active: t.is_active } : x))); flash("변경하지 못했어요."); }
      else flash(`${t.name} 기사를 ${next ? "활성" : "비활성"}으로 바꿨어요.`);
    } catch { flash("처리 중 오류가 생겼어요."); }
  }

  return (
    <div className="setw">
      <style>{SET_CSS}</style>
      <div className="ph"><div><h1>설정</h1><div className="sub">방문 가능 건수 · 기사 · 알림톡 · 데이터</div></div></div>
      {localMode ? <div className="set-note">지금은 <b>미리보기(로컬)</b>예요. 실제 저장은 프로덕션에서 됩니다.</div> : null}

      <div className="setgrid">
        <div className="card">
          <h3>하루 방문 가능 건수</h3>
          <p>오전·오후 각각 몇 건까지 받을지. 예약 달력에 바로 반영돼요.</p>
          <div className="capbox">
            <div className="capnum num">{cap}<small>건</small></div>
            <div className="stepper"><button onClick={() => changeCap(-1)}>−</button><button onClick={() => changeCap(1)}>+</button></div>
          </div>
          <div className="caphint">비우면(0) 활성 기사 수 기준 자동 설정</div>
        </div>

        <div className="card">
          <h3>기사 관리</h3>
          <p>활성 기사 수만큼 하루 방문을 받아요.</p>
          {techs.length ? techs.map((t) => (
            <div className="tech" key={t.id}>
              <span className="av" style={{ background: t.is_active ? undefined : "var(--surface-3)", color: t.is_active ? undefined : "var(--text-faint)" }}>{t.name.slice(0, 1)}</span>
              <div><div className="nm">{t.name}</div><div className="st">{t.is_active ? (t.weekCount != null ? `이번 주 ${t.weekCount}건` : "활성") : "비활성"}</div></div>
              <button className={`sw ${t.is_active ? "" : "off"}`} onClick={() => toggleTech(t)} aria-label="기사 활성 토글" />
            </div>
          )) : <div className="tech-empty">등록된 기사가 없어요. <Link href="/admin/technicians">기사 추가 →</Link></div>}
          <Link href="/admin/technicians" className="cardlink">기사 상세 관리 →</Link>
        </div>

        <div className="card">
          <h3>알림톡 자동발송</h3>
          <p>고객에게 자동으로 보낼 안내. <span className="tag">표시용</span></p>
          {[["intake", "접수 확인"], ["quote", "견적서 발송"], ["remind", "방문 하루 전 리마인드"], ["review", "완료 후 후기 요청"]].map(([k, label], i, arr) => (
            <div className="togrow" key={k} style={i === arr.length - 1 ? { border: "none" } : undefined}>
              {label}
              <button className={`sw ${autos[k] ? "" : "off"}`} onClick={() => { setAutos((a) => ({ ...a, [k]: !a[k] })); flash("이 항목은 아직 표시용이에요 (백엔드 연결 예정)."); }} aria-label="토글" />
            </div>
          ))}
        </div>

        <div className="card">
          <h3>데이터</h3>
          <p>주문·정산 내역 엑셀 내보내기.</p>
          <a className="dbtn" href="/api/admin/data-export">주문 내역 (.xlsx)</a>
          <a className="dbtn" href="/api/admin/data-export?include_pii=1">개인정보 포함 (.xlsx)</a>
          <Link href="/admin/settings/manage" className="cardlink">카카오 링크·대표번호·FAQ 등 운영 설정 →</Link>
        </div>
      </div>
      {msg ? <div className="set-toast">{msg}</div> : null}
    </div>
  );
}

const SET_CSS = `
.setw { --surface:#fff; --surface-2:#f2f4f7; --surface-3:#f2f4f7; --text:#101828; --text-muted:#667085; --text-faint:#98a2b3; --border:#e5e7eb; --accent:#245fff; --accent-soft:#eff4ff; --accent-text:#1647d7; --green:#178a4c; color:var(--text); padding: 26px clamp(16px, 2.4vw, 34px) 48px; }
.setw .num { font-variant-numeric: tabular-nums; }
.setw .ph { margin-bottom: 18px; }
.setw .ph h1 { font-size: 23px; font-weight: 800; letter-spacing: -0.03em; margin: 0; }
.setw .ph .sub { color: var(--text-muted); font-size: 13.5px; margin-top: 5px; }
.set-note { background: #eef3ff; border: 1px solid #cddbff; color: #244a9c; border-radius: 12px; padding: 12px 16px; font-size: 13px; margin-bottom: 16px; }
.setgrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; }
.card h3 { margin: 0 0 4px; font-size: 15px; font-weight: 800; }
.card p { margin: 0 0 16px; font-size: 12.5px; color: var(--text-faint); }
.card .tag { background: var(--surface-2); color: var(--text-muted); font-weight: 700; font-size: 10.5px; padding: 1px 7px; border-radius: 999px; margin-left: 4px; }
.capbox { display: flex; align-items: center; gap: 18px; }
.capnum { font-size: 40px; font-weight: 800; }
.capnum small { font-size: 15px; color: var(--text-faint); font-weight: 700; margin-left: 3px; }
.stepper { display: flex; gap: 8px; }
.stepper button { width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface-2); font-size: 22px; font-weight: 700; color: var(--text-muted); cursor: pointer; }
.stepper button:hover { border-color: var(--accent); color: var(--accent-text); }
.caphint { margin-top: 12px; font-size: 11.5px; color: var(--text-faint); }
.tech { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--border); }
.tech .av { width: 36px; height: 36px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-text); display: grid; place-items: center; font-weight: 800; font-size: 14px; }
.tech .nm { font-weight: 800; font-size: 13.5px; }
.tech .st { font-size: 11.5px; color: var(--text-faint); margin-top: 1px; }
.tech .sw { margin-left: auto; }
.tech-empty { font-size: 13px; color: var(--text-faint); padding: 10px 0; }
.togrow { display: flex; align-items: center; justify-content: space-between; padding: 13px 0; border-bottom: 1px solid var(--border); font-size: 13.5px; font-weight: 600; }
.sw { width: 42px; height: 24px; border-radius: 999px; border: none; background: var(--accent); cursor: pointer; position: relative; flex-shrink: 0; }
.sw::after { content: ""; position: absolute; top: 3px; left: 21px; width: 18px; height: 18px; border-radius: 999px; background: #fff; transition: left .15s; }
.sw.off { background: #cdd4de; }
.sw.off::after { left: 3px; }
.dbtn { display: block; width: 100%; margin-bottom: 9px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-muted); font-weight: 800; font-size: 13px; padding: 12px; border-radius: 11px; cursor: pointer; text-align: center; text-decoration: none; }
.dbtn:hover { border-color: var(--accent); color: var(--accent-text); }
.cardlink { display: block; margin-top: 10px; font-size: 12px; color: var(--text-faint); text-decoration: none; }
.cardlink:hover { color: var(--accent-text); }
.set-toast { position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%); background: #101828; color: #fff; font-size: 13px; font-weight: 700; padding: 12px 20px; border-radius: 999px; z-index: 70; }
@media (max-width: 900px) { .setgrid { grid-template-columns: 1fr; } }
`;
