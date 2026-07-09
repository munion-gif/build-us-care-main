"use client";

import Link from "next/link";
import type { Dashboard } from "@/lib/admin-dashboard-data";

export function DashboardClient({ d }: { d: Dashboard }) {
  const stats = [
    { key: "intake", label: "새 사진접수", value: d.stats.newIntake, tone: "violet", href: "/admin/intake", hint: "견적 작성 필요" },
    { key: "payment", label: "입금 확인 대기", value: d.stats.paymentPending, tone: "amber", href: "/admin/orders", hint: "입금 확인 후 진행" },
    { key: "visit", label: "방문 확정 대기", value: d.stats.visitPending, tone: "blue", href: "/admin/orders", hint: "일정 확인 후 확정" },
    { key: "today", label: "오늘 방문", value: d.stats.todayVisit, tone: "green", href: "/admin/slots", hint: "오늘 예정된 방문" }
  ];
  const shortcuts = [
    { label: "사진접수", desc: "사진 보고 견적 작성·발송", href: "/admin/intake", icon: "📸" },
    { label: "예약·주문", desc: "입금 확인·방문 확정·취소", href: "/admin/orders", icon: "📋" },
    { label: "일정", desc: "방문 달력·휴무 관리", href: "/admin/slots", icon: "📅" },
    { label: "설정", desc: "방문 건수·기사·알림톡", href: "/admin/settings", icon: "⚙️" }
  ];

  return (
    <div className="dash">
      <style>{DASH_CSS}</style>

      <div className="d-head">
        <div>
          <h1>대시보드</h1>
          <div className="sub">오늘 {d.todayText} · 한눈에 보는 현황</div>
        </div>
        {!d.hasDb ? <div className="d-note">미리보기(로컬) · 샘플 데이터</div> : null}
      </div>

      <div className="d-stats">
        {stats.map((s) => (
          <Link key={s.key} href={s.href} className={`d-stat t-${s.tone}`}>
            <div className="d-stat-label">{s.label}</div>
            <div className="d-stat-value num">{s.value}<small>건</small></div>
            <div className="d-stat-hint">{s.hint} →</div>
          </Link>
        ))}
      </div>

      <div className="d-cols">
        <section className="d-card">
          <h3>오늘 방문 일정 <span className="badge">{d.todayVisits.length}건</span></h3>
          {d.todayVisits.length ? (
            <div className="d-visits">
              {d.todayVisits.map((v, i) => (
                <div className="d-visit" key={i}>
                  <span className="vt">{v.slot || "시간"}</span>
                  <div><div className="vn">{v.name}</div><div className="vd">{v.address || "주소 미입력"}</div></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="d-empty">오늘 예정된 방문이 없어요.</div>
          )}
          <Link href="/admin/slots" className="d-more">일정 전체 보기 →</Link>
        </section>

        <section className="d-card">
          <h3>최근 사진접수</h3>
          {d.recentIntakes.length ? (
            <div className="d-recent">
              {d.recentIntakes.map((r) => (
                <Link key={r.id} href={`/admin/intake?id=${encodeURIComponent(r.id)}`} className="d-r">
                  <div className="d-r-l">
                    <span className="d-r-name">{r.name}</span>
                    {r.isNew ? <span className="d-r-new">새 접수</span> : null}
                  </div>
                  <div className="d-r-r"><span className="d-r-item">{r.item}</span><span className="d-r-at num">{r.at ?? ""}</span></div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="d-empty">아직 접수 내역이 없어요.</div>
          )}
          <Link href="/admin/intake" className="d-more">사진접수 전체 보기 →</Link>
        </section>
      </div>

      <div className="d-shortcuts">
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href} className="d-sc">
            <span className="d-sc-ico">{s.icon}</span>
            <div><div className="d-sc-label">{s.label}</div><div className="d-sc-desc">{s.desc}</div></div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const DASH_CSS = `
.dash { display: flex !important; flex-direction: column !important; align-items: stretch !important; --surface:#fff; --surface-2:#f5f7fa; --text:#0f1729; --text-muted:#5b6472; --text-faint:#8b95a6; --border:#e4e8ee; --accent:#245fff; --accent-soft:#eaf0ff; --accent-text:#1a49cc; --green:#178a4c; --green-soft:#e6f6ec; --amber:#b7791f; --amber-soft:#fdf3e2; --violet:#6d5bd0; --violet-soft:#efecfb; color:var(--text); }
.dash .num { font-variant-numeric: tabular-nums; }
.d-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.d-head h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; margin: 0; }
.d-head .sub { color: var(--text-muted); font-size: 13.5px; margin-top: 5px; }
.d-note { background: #eef3ff; border: 1px solid #cddbff; color: #244a9c; border-radius: 999px; padding: 6px 13px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.d-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
.d-stat { display: block; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 18px; text-decoration: none; color: inherit; border-top: 3px solid var(--border); transition: transform .08s; }
.d-stat:hover { transform: translateY(-2px); }
.d-stat.t-violet { border-top-color: var(--violet); }
.d-stat.t-amber { border-top-color: var(--amber); }
.d-stat.t-blue { border-top-color: var(--accent); }
.d-stat.t-green { border-top-color: var(--green); }
.d-stat-label { font-size: 13px; color: var(--text-muted); font-weight: 700; }
.d-stat-value { font-size: 34px; font-weight: 800; margin: 6px 0 4px; }
.d-stat-value small { font-size: 14px; color: var(--text-faint); font-weight: 700; margin-left: 3px; }
.t-violet .d-stat-value { color: var(--violet); } .t-amber .d-stat-value { color: var(--amber); } .t-blue .d-stat-value { color: var(--accent); } .t-green .d-stat-value { color: var(--green); }
.d-stat-hint { font-size: 12px; color: var(--text-faint); }
.d-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
.d-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 18px; }
.d-card h3 { margin: 0 0 14px; font-size: 15px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
.d-card h3 .badge { margin-left: auto; font-size: 11px; font-weight: 700; color: var(--text-faint); background: var(--surface-2); padding: 2px 9px; border-radius: 999px; }
.d-visits { display: flex; flex-direction: column; gap: 8px; }
.d-visit { display: flex; gap: 10px; align-items: flex-start; padding: 11px; background: var(--surface-2); border-radius: 11px; }
.d-visit .vt { background: var(--accent-soft); color: var(--accent-text); font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 7px; white-space: nowrap; }
.d-visit .vn { font-weight: 800; font-size: 13.5px; }
.d-visit .vd { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.d-recent { display: flex; flex-direction: column; }
.d-r { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 0; border-bottom: 1px solid var(--border); text-decoration: none; color: inherit; }
.d-r:last-child { border-bottom: none; }
.d-r-l { display: flex; align-items: center; gap: 8px; }
.d-r-name { font-weight: 800; font-size: 13.5px; }
.d-r-new { background: var(--violet-soft); color: var(--violet); font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 999px; white-space: nowrap; }
.d-r-r { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--text-faint); }
.d-r-item { color: var(--text-muted); }
.d-empty { padding: 22px 0; text-align: center; color: var(--text-faint); font-size: 13px; }
.d-more { display: inline-block; margin-top: 12px; font-size: 12.5px; color: var(--text-faint); text-decoration: none; font-weight: 700; }
.d-more:hover { color: var(--accent-text); }
.d-shortcuts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.d-sc { display: flex; align-items: center; gap: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 15px; text-decoration: none; color: inherit; }
.d-sc:hover { border-color: var(--accent); }
.d-sc-ico { font-size: 22px; }
.d-sc-label { font-weight: 800; font-size: 14px; }
.d-sc-desc { font-size: 11.5px; color: var(--text-faint); margin-top: 2px; }
@media (max-width: 1000px) { .d-stats, .d-shortcuts { grid-template-columns: repeat(2, 1fr); } .d-cols { grid-template-columns: 1fr; } }
`;
