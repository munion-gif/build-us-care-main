"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { adminFetch, won } from "./_lib/ui";
import {
  AdminOrderRow,
  orderJob,
  orderStage,
  orderItemsSummary,
  serviceLabel,
  shortRegion
} from "./_lib/orders-shared";

type Stats = {
  todayOrders: number;
  todayPaid: number;
  pendingDiagnoses: number;
  weekCompletedJobs: number;
  weekRevenue: number;
  pendingQuotes: number;
  issueJobs: number;
};

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
}

// 실매출 집계 시작일 — 이 날짜 이전 주문은 네이버 블로그 체험단(무상 시공)이라 매출 집계에서 제외
const REVENUE_START = new Date("2026-07-10T00:00:00+09:00");

export default function AdminHomePage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tip, setTip] = useState<{ x: number; y: number; text: string; sub: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [s, o] = await Promise.all([
        adminFetch<Stats>("/api/admin/stats"),
        adminFetch<{ orders: AdminOrderRow[] }>("/api/admin/orders?limit=300")
      ]);
      if (s.ok && s.data) setStats(s.data);
      if (o.ok && o.data) setOrders((o.data.orders ?? []).filter((x) => !x.deleted_at && !x.is_test));
      setLoading(false);
    })();
  }, []);

  const now = new Date();
  const todayKey = now.toDateString();

  const counts = useMemo(() => {
    const c = { pay: 0, assign: 0, todayVisits: 0, cancel: 0 };
    for (const o of orders) {
      const st = orderStage(o);
      if (st === "pay") c.pay += 1;
      if (st === "assign") c.assign += 1;
      if ((o.status ?? "") === "cancel_requested") c.cancel += 1;
      const job = orderJob(o);
      if (job?.scheduled_at && new Date(job.scheduled_at).toDateString() === todayKey && st === "booked") {
        c.todayVisits += 1;
      }
    }
    return c;
  }, [orders, todayKey]);

  const weeks = useMemo(() => {
    const base = startOfWeek(now);
    const list: Array<{ label: string; start: Date; end: Date; sum: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(base);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      list.push({ label: `${start.getMonth() + 1}/${start.getDate()}`, start, end, sum: 0 });
    }
    for (const o of orders) {
      const stage = orderStage(o);
      if (!["assign", "booked", "done"].includes(stage)) continue;
      const t = o.created_at ? new Date(o.created_at) : null;
      if (!t || t < REVENUE_START) continue;
      for (const w of list) {
        if (t >= w.start && t < w.end) {
          w.sum += Number(o.total_amount ?? 0);
          break;
        }
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, todayKey]);

  const monthStats = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    let revenue = 0;
    let count = 0;
    const itemCounts = new Map<string, number>();
    for (const o of orders) {
      const t = o.created_at ? new Date(o.created_at) : null;
      if (!t || t < start || t < REVENUE_START) continue;
      const stage = orderStage(o);
      if (!["assign", "booked", "done"].includes(stage)) continue;
      revenue += Number(o.total_amount ?? 0);
      count += 1;
      const label = serviceLabel(o.service_type_code);
      itemCounts.set(label, (itemCounts.get(label) ?? 0) + 1);
    }
    const items = [...itemCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
    return { revenue, count, items };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, todayKey]);

  const upcoming = useMemo(() => {
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return orders
      .map((o) => ({ o, job: orderJob(o) }))
      .filter(({ o, job }) => job?.scheduled_at && new Date(job.scheduled_at!) >= startToday && orderStage(o) === "booked")
      .sort((a, b) => new Date(a.job!.scheduled_at!).getTime() - new Date(b.job!.scheduled_at!).getTime())
      .slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, todayKey]);

  const W = 560;
  const H = 216;
  const L = 46;
  const R = 8;
  const T = 16;
  const B = 26;
  const plotH = H - T - B;
  const chartBase = H - B;
  const maxV = Math.max(100000, ...weeks.map((w) => w.sum));
  const slot = (W - L - R) / weeks.length;
  const barW = Math.min(44, slot - 14);
  const y = (v: number) => chartBase - (v / maxV) * plotH;
  const maxIdx = weeks.reduce((mi, w, i) => (w.sum > weeks[mi].sum ? i : mi), 0);
  const gridVals = [0, 0.5, 1].map((f) => Math.round((maxV * f) / 10000) * 10000);

  const dateLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${["일", "월", "화", "수", "목", "금", "토"][now.getDay()]}요일`;

  return (
    <>
      <h1>홈</h1>
      <p className="h-sub">{dateLabel} · 오늘 처리할 일과 이번 달 흐름을 한눈에.</p>

      <div className="today five" role="group" aria-label="오늘 할 일">
        <button
          className={stats && stats.pendingDiagnoses > 0 ? "hot" : ""}
          onClick={() => router.push("/admin/inquiries")}
        >
          <span className="k">
            <span className="dot" style={{ background: "var(--info)" }} />
            사진문의 답장
          </span>
          <div className="v">
            {stats?.pendingDiagnoses ?? "…"}
            <small>대기 중</small>
          </div>
        </button>
        <button className={counts.pay > 0 ? "hot" : ""} onClick={() => router.push("/admin/orders?tab=pay")}>
          <span className="k">
            <span className="dot" style={{ background: "var(--warn)" }} />
            입금 확인
          </span>
          <div className="v">
            {loading ? "…" : counts.pay}
            <small>계좌이체</small>
          </div>
        </button>
        <button className={counts.assign > 0 ? "hot" : ""} onClick={() => router.push("/admin/orders?tab=assign")}>
          <span className="k">
            <span className="dot" style={{ background: "var(--accent)" }} />
            기사 배정
          </span>
          <div className="v">
            {loading ? "…" : counts.assign}
            <small>결제 완료</small>
          </div>
        </button>
        <button onClick={() => router.push("/admin/calendar")}>
          <span className="k">
            <span className="dot" style={{ background: "var(--good)" }} />
            오늘 방문
          </span>
          <div className="v">
            {loading ? "…" : counts.todayVisits}
            <small>예약 확정</small>
          </div>
        </button>
        <button className={counts.cancel > 0 ? "hot" : ""} onClick={() => router.push("/admin/orders?tab=cancel")}>
          <span className="k">
            <span className="dot" style={{ background: "var(--bad)" }} />
            취소 요청
          </span>
          <div className="v">
            {loading ? "…" : counts.cancel}
            <small>환불 결정</small>
          </div>
        </button>
      </div>

      <div className="home-grid">
        <div className="panel">
          <div className="p-head">
            <span className="p-t">주간 매출</span>
            <span className="p-link" role="presentation">
              최근 6주 · 결제 완료 기준
            </span>
          </div>
          <p className="p-s">막대에 마우스를 올리면 금액이 보여요.</p>
          <div className="chart-wrap">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="주간 매출 차트">
              {gridVals.map((v) => (
                <g key={v}>
                  <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--line-2)" strokeWidth="1" />
                  <text x={L - 7} y={y(v) + 4} textAnchor="end" fontSize="10.5" fill="var(--ink-3)">
                    {Math.round(v / 10000)}만
                  </text>
                </g>
              ))}
              {weeks.map((w, i) => {
                const x = L + slot * i + (slot - barW) / 2;
                const ty = y(w.sum);
                const r = 4;
                const last = i === weeks.length - 1;
                return (
                  <g key={w.label}>
                    {w.sum > 0 && (
                      <path
                        d={`M${x},${chartBase} L${x},${Math.min(ty + r, chartBase)} Q${x},${ty} ${x + r},${ty} L${x + barW - r},${ty} Q${x + barW},${ty} ${x + barW},${Math.min(ty + r, chartBase)} L${x + barW},${chartBase} Z`}
                        fill="var(--chart)"
                        opacity={last ? 0.45 : 1}
                      />
                    )}
                    {(i === maxIdx || last) && w.sum > 0 && (
                      <text x={x + barW / 2} y={ty - 6} textAnchor="middle" fontSize="11" fontWeight="650" fill="var(--ink-2)">
                        {Math.round(w.sum / 10000)}만{last ? "·진행" : ""}
                      </text>
                    )}
                    <text x={x + barW / 2} y={H - 9} textAnchor="middle" fontSize="10.5" fill="var(--ink-3)">
                      {w.label}
                    </text>
                    <rect
                      x={L + slot * i}
                      y={T}
                      width={slot}
                      height={plotH}
                      fill="transparent"
                      onMouseEnter={(e) => {
                        const wrap = (e.currentTarget.ownerSVGElement?.parentElement as HTMLElement) ?? null;
                        const k = wrap ? wrap.getBoundingClientRect().width / W : 1;
                        setTip({
                          x: (L + slot * i + slot / 2) * k,
                          y: y(w.sum) * k,
                          text: won(w.sum),
                          sub: `${w.label} 주${last ? " · 진행 중" : ""}`
                        });
                      }}
                      onMouseLeave={() => setTip(null)}
                    />
                  </g>
                );
              })}
            </svg>
            <div className={`chart-tip ${tip ? "on" : ""}`} style={{ left: tip?.x ?? 0, top: tip?.y ?? 0 }}>
              {tip?.text}
              <small>{tip?.sub}</small>
            </div>
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <div className="s-k">이번 달 매출 (결제 기준)</div>
            <div className="s-v">{loading ? "…" : won(monthStats.revenue)}</div>
            <div className="s-d">이번 주 완료 시공 {stats?.weekCompletedJobs ?? 0}건</div>
          </div>
          <div className="stat">
            <div className="s-k">이번 달 결제 주문</div>
            <div className="s-v">{loading ? "…" : `${monthStats.count}건`}</div>
            <div className="s-d">
              오늘 신규 {stats?.todayOrders ?? 0} · 오늘 결제 {stats?.todayPaid ?? 0}
            </div>
          </div>
          <div className="stat">
            <div className="s-k">견적·결제 대기</div>
            <div className="s-v">{stats ? `${stats.pendingQuotes}건` : "…"}</div>
            <div className="s-d">사진문의 대기 {stats?.pendingDiagnoses ?? 0}건</div>
          </div>
        </div>
      </div>

      <div className="home-grid half">
        <div className="panel">
          <div className="p-head">
            <span className="p-t">다가오는 방문</span>
            <Link className="p-link" href="/admin/calendar">
              캘린더 보기 →
            </Link>
          </div>
          <p className="p-s">누르면 해당 주문이 열려요.</p>
          {loading ? (
            <div className="spin" />
          ) : upcoming.length === 0 ? (
            <p className="loading-note">예정된 방문이 없어요.</p>
          ) : (
            upcoming.map(({ o, job }) => {
              const d = new Date(job!.scheduled_at!);
              const isToday = d.toDateString() === todayKey;
              const tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
              const isTmr = d.toDateString() === tmr.toDateString();
              const dayLabel = isToday ? "오늘" : isTmr ? "내일" : `${d.getMonth() + 1}/${d.getDate()}`;
              const time = d.getHours() < 12 ? "오전" : "오후";
              return (
                <button key={o.id} className="sched-row" onClick={() => router.push(`/admin/orders?open=${o.id}`)}>
                  <span className={`sr-day ${isToday ? "t" : "n"}`}>{dayLabel}</span>
                  <span className="sr-tm">{time}</span>
                  <span className="sr-who">
                    {o.customers?.name ?? "고객"} · {orderItemsSummary(o)}
                  </span>
                  <span className="sr-loc">{shortRegion(o.homes?.address_full)}</span>
                </button>
              );
            })
          )}
        </div>
        <div className="panel">
          <div className="p-head">
            <span className="p-t">품목별 주문</span>
            <span className="p-link" role="presentation">
              이번 달 · 건수
            </span>
          </div>
          <p className="p-s">이번 달 1일부터 오늘까지 결제된 주문 기준.</p>
          {loading ? (
            <div className="spin" />
          ) : monthStats.items.length === 0 ? (
            <p className="loading-note">이번 달 결제된 주문이 아직 없어요.</p>
          ) : (
            monthStats.items.map(([label, count]) => {
              const max = monthStats.items[0][1];
              return (
                <div className="hb-row" key={label}>
                  <span className="hb-k">{label}</span>
                  <span className="hb-track">
                    <span className="hb-fill" style={{ width: `${(count / max) * 100}%`, display: "block" }} />
                  </span>
                  <span className="hb-v">{count}건</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
