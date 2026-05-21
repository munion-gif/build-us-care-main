"use client";

import { useEffect, useMemo, useState } from "react";

type FunnelStep = {
  eventType: string;
  label: string;
  sessions: number;
  conversionFromPrevious: number | null;
};

type ChannelStep = {
  eventType: string;
  label: string;
  sessions: number;
  conversionFromPrevious: number | null;
};

type FunnelResponse = {
  period: "7d" | "30d";
  steps: FunnelStep[];
  channels: Record<string, ChannelStep[]>;
};

function formatPercent(value: number | null) {
  if (value === null) return "-";
  return `${value.toFixed(1)}%`;
}

function channelLabel(channel: string) {
  const labels: Record<string, string> = {
    kakao: "카카오",
    instagram: "인스타그램",
    web: "웹",
    direct: "직접 유입"
  };
  return labels[channel] ?? channel;
}

export default function AdminFunnelPage() {
  const [period, setPeriod] = useState<"7d" | "30d">("7d");
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/funnel?period=${period}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.message ?? "퍼널 데이터를 불러오지 못했어요.");
        }
        if (!ignore) setData(payload.data);
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "퍼널 데이터를 불러오지 못했어요.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [period]);

  const channels = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.channels).sort(([a], [b]) => channelLabel(a).localeCompare(channelLabel(b), "ko"));
  }, [data]);

  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">퍼널 분석</h1>
        <p className="adm-page-sub">사진 판정 요청부터 견적, 주소 입력, 주문, 결제 완료까지 고객 이탈 구간을 확인합니다.</p>
      </header>
      <div className="adm-content">
        <div className="adm-filter-bar">
          <button className={`adm-btn ${period === "7d" ? "adm-btn-primary" : "adm-btn-secondary"}`} type="button" onClick={() => setPeriod("7d")}>
            최근 7일
          </button>
          <button className={`adm-btn ${period === "30d" ? "adm-btn-primary" : "adm-btn-secondary"}`} type="button" onClick={() => setPeriod("30d")}>
            최근 30일
          </button>
        </div>

        {loading && (
          <section className="adm-card">
            <p className="adm-page-sub">퍼널 데이터를 불러오는 중입니다.</p>
          </section>
        )}

        {error && (
          <section className="adm-card">
            <p className="adm-page-sub">{error}</p>
          </section>
        )}

        {!loading && !error && data && (
          <>
            <section className="adm-section adm-table-wrap">
              <table className="adm-table">
                <caption className="adm-card-title">전체 전환 퍼널</caption>
                <thead>
                  <tr>
                    <th>단계</th>
                    <th>고유 세션</th>
                    <th>직전 단계 전환율</th>
                  </tr>
                </thead>
                <tbody>
                  {data.steps.map((step) => (
                    <tr key={step.eventType}>
                      <td>{step.label}</td>
                      <td>{step.sessions.toLocaleString("ko-KR")}건</td>
                      <td>{formatPercent(step.conversionFromPrevious)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="adm-section">
              <h2 className="adm-section-title">채널별 퍼널</h2>
              <div className="adm-kpi-grid">
                {channels.map(([channel, steps]) => {
                  const first = steps[0]?.sessions ?? 0;
                  const completed = steps[steps.length - 1]?.sessions ?? 0;
                  const finalConversion = first > 0 ? (completed / first) * 100 : 0;
                  return (
                    <article className="adm-kpi-card" key={channel}>
                      <div className="adm-kpi-label">{channelLabel(channel)}</div>
                      <div className="adm-kpi-value">{formatPercent(finalConversion)}</div>
                      <div className="adm-kpi-sub">사진 판정 {first.toLocaleString("ko-KR")}건 / 결제완료 {completed.toLocaleString("ko-KR")}건</div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="adm-section adm-table-wrap">
              <table className="adm-table">
                <caption className="adm-card-title">채널별 단계 상세</caption>
                <thead>
                  <tr>
                    <th>채널</th>
                    <th>단계</th>
                    <th>고유 세션</th>
                    <th>전환율</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.flatMap(([channel, steps]) =>
                    steps.map((step) => (
                      <tr key={`${channel}-${step.eventType}`}>
                        <td>{channelLabel(channel)}</td>
                        <td>{step.label}</td>
                        <td>{step.sessions.toLocaleString("ko-KR")}건</td>
                        <td>{formatPercent(step.conversionFromPrevious)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </>
  );
}
