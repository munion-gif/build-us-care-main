import { cookies } from "next/headers";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, ShieldCheck, XCircle } from "lucide-react";
import { ADMIN_SESSION_MAX_AGE_SECONDS, verifyAdminSessionToken } from "@/lib/admin-session";
import { hasSupabaseEnv, getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type CheckStatus = "pass" | "warn" | "fail" | "info";

type SecurityCheck = {
  label: string;
  status: CheckStatus;
  summary: string;
  detail: string;
};

type CountResult = {
  value: number | null;
  error: string | null;
};

type SecurityData = {
  counts: {
    recentOrders: CountResult;
    recentDiagnoses: CountResult;
    recentEvents: CountResult;
    recentLookups: CountResult;
    testOrders: CountResult;
    testDiagnoses: CountResult;
    trashedOrders: CountResult;
  };
  traffic: {
    sources: Array<{ key: string; events: number; sessions: number; orders: number }>;
    campaigns: Array<{ key: string; events: number; orders: number }>;
    landings: Array<{ key: string; events: number; orders: number }>;
    eventRowsChecked: number;
    orderRowsChecked: number;
  };
  lastUpdated: string;
};

const STATUS_LABELS: Record<CheckStatus, string> = {
  pass: "정상",
  warn: "주의",
  fail: "위험",
  info: "참고"
};

function statusClass(status: CheckStatus) {
  return `adm-security-status adm-security-status-${status}`;
}

function statusIcon(status: CheckStatus) {
  if (status === "pass") return <CheckCircle2 aria-hidden="true" size={17} />;
  if (status === "fail") return <XCircle aria-hidden="true" size={17} />;
  if (status === "warn") return <AlertTriangle aria-hidden="true" size={17} />;
  return <Info aria-hidden="true" size={17} />;
}

function secretCheck(label: string, value: string | undefined, minLength: number, detail: string): SecurityCheck {
  if (!value) {
    return {
      label,
      status: "fail",
      summary: "미설정",
      detail
    };
  }

  if (value.length < minLength) {
    return {
      label,
      status: "warn",
      summary: "설정됨, 길이 점검 필요",
      detail: `${detail} 현재 값은 표시하지 않지만 권장 길이보다 짧습니다.`
    };
  }

  return {
    label,
    status: "pass",
    summary: "설정됨",
    detail
  };
}

function envFlag(label: string, value: string | undefined, required: boolean, detail: string): SecurityCheck {
  if (value) {
    return {
      label,
      status: "pass",
      summary: "설정됨",
      detail
    };
  }

  return {
    label,
    status: required ? "fail" : "info",
    summary: required ? "미설정" : "미사용",
    detail
  };
}

function adminAllowedIpsCheck(): SecurityCheck {
  const count = (process.env.ADMIN_ALLOWED_IPS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean).length;

  if (count === 0) {
    return {
      label: "관리자 IP 허용 목록",
      status: "warn",
      summary: "미설정",
      detail: "설정하지 않으면 기존처럼 모든 IP에서 관리자 로그인 페이지 접근이 가능합니다."
    };
  }

  return {
    label: "관리자 IP 허용 목록",
    status: "pass",
    summary: `${count}개 등록됨`,
    detail: "등록된 IP에서만 /admin과 /admin/login 접근이 가능합니다. IP 값은 화면에 표시하지 않습니다."
  };
}

async function safeCount(query: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<CountResult> {
  try {
    const { count, error } = await query;
    if (error) return { value: null, error: error.message };
    return { value: count ?? 0, error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : "count_failed" };
  }
}

function recentSince(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function loadSecurityData(): Promise<SecurityData> {
  const empty = { value: null, error: hasSupabaseEnv() ? null : "supabase_not_configured" };
  if (!hasSupabaseEnv()) {
    return {
      counts: {
        recentOrders: empty,
        recentDiagnoses: empty,
        recentEvents: empty,
        recentLookups: empty,
        testOrders: empty,
        testDiagnoses: empty,
        trashedOrders: empty
      },
      traffic: {
        sources: [],
        campaigns: [],
        landings: [],
        eventRowsChecked: 0,
        orderRowsChecked: 0
      },
      lastUpdated: new Date().toISOString()
    };
  }

  const supabase = getSupabaseAdmin();
  const since24h = recentSince(24);
  const since7d = recentSince(24 * 7);

  const [
    recentOrders,
    recentDiagnoses,
    recentEvents,
    recentLookups,
    testOrders,
    testDiagnoses,
    trashedOrders,
    trafficEvents,
    trafficOrders
  ] = await Promise.all([
    safeCount(
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("is_test", false)
        .is("deleted_at", null)
        .gte("created_at", since24h)
    ),
    safeCount(
      supabase
        .from("diagnoses")
        .select("id", { count: "exact", head: true })
        .eq("is_test", false)
        .gte("created_at", since24h)
    ),
    safeCount(
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", since24h)
    ),
    safeCount(
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "order_lookup")
        .gte("occurred_at", since24h)
    ),
    safeCount(
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("is_test", true)
        .is("deleted_at", null)
    ),
    safeCount(
      supabase
        .from("diagnoses")
        .select("id", { count: "exact", head: true })
        .eq("is_test", true)
    ),
    safeCount(
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .not("deleted_at", "is", null)
    ),
    supabase
      .from("events")
      .select("id,event_type,session_id,source,campaign,landing_path,properties,occurred_at")
      .gte("occurred_at", since7d)
      .order("occurred_at", { ascending: false })
      .limit(1000),
    supabase
      .from("orders")
      .select("id,source,campaign,landing_path,created_at")
      .eq("is_test", false)
      .is("deleted_at", null)
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(500)
  ]);
  const trafficSourceEvents = new Map<string, number>();
  const trafficSourceSessions = new Map<string, Set<string>>();
  const trafficSourceOrders = new Map<string, number>();
  const campaignEvents = new Map<string, number>();
  const campaignOrders = new Map<string, number>();
  const landingEvents = new Map<string, number>();
  const landingOrders = new Map<string, number>();
  const eventRows = trafficEvents.data ?? [];
  const orderRows = trafficOrders.data ?? [];

  for (const row of eventRows as any[]) {
    const source = trafficValueFromProperties(row, "source", "direct");
    const campaign = trafficValueFromProperties(row, "campaign", "캠페인 없음");
    const landing = trafficValueFromProperties(row, "landing_path", "경로 없음");
    incrementMap(trafficSourceEvents, source);
    incrementMap(campaignEvents, campaign);
    incrementMap(landingEvents, landing);
    if (row.session_id) {
      const sessions = trafficSourceSessions.get(source) ?? new Set<string>();
      sessions.add(String(row.session_id));
      trafficSourceSessions.set(source, sessions);
    }
  }

  for (const row of orderRows as any[]) {
    const source = cleanTrafficValue(row.source, "direct").toLowerCase();
    const campaign = cleanTrafficValue(row.campaign, "캠페인 없음");
    const landing = cleanTrafficValue(row.landing_path, "경로 없음");
    incrementMap(trafficSourceOrders, source);
    incrementMap(campaignOrders, campaign);
    incrementMap(landingOrders, landing);
  }

  const trafficSources = Array.from(new Set([...trafficSourceEvents.keys(), ...trafficSourceOrders.keys()])).map((key) => ({
    key,
    events: trafficSourceEvents.get(key) ?? 0,
    sessions: trafficSourceSessions.get(key)?.size ?? 0,
    orders: trafficSourceOrders.get(key) ?? 0
  }));
  const trafficCampaigns = Array.from(new Set([...campaignEvents.keys(), ...campaignOrders.keys()])).map((key) => ({
    key,
    events: campaignEvents.get(key) ?? 0,
    orders: campaignOrders.get(key) ?? 0
  }));
  const trafficLandings = Array.from(new Set([...landingEvents.keys(), ...landingOrders.keys()])).map((key) => ({
    key,
    events: landingEvents.get(key) ?? 0,
    orders: landingOrders.get(key) ?? 0
  }));

  return {
    counts: {
      recentOrders,
      recentDiagnoses,
      recentEvents,
      recentLookups,
      testOrders,
      testDiagnoses,
      trashedOrders
    },
    traffic: {
      sources: sortedTrafficRows(trafficSources, 6),
      campaigns: sortedTrafficRows(trafficCampaigns, 5),
      landings: sortedTrafficRows(trafficLandings, 5),
      eventRowsChecked: eventRows.length,
      orderRowsChecked: orderRows.length
    },
    lastUpdated: new Date().toISOString()
  };
}

function countText(result: CountResult) {
  if (result.error) return "확인 실패";
  return `${result.value ?? 0}건`;
}

function countSub(result: CountResult, fallback: string) {
  return result.error ? result.error : fallback;
}

function cleanTrafficValue(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function trafficSourceLabel(source: string) {
  const labels: Record<string, string> = {
    instagram: "Instagram",
    kakao: "Kakao",
    organic: "Organic",
    direct: "Direct",
    web: "Web",
    phone: "전화",
    offline: "Offline"
  };
  return labels[source] ?? source;
}

function trafficValueFromProperties(row: any, key: "source" | "campaign" | "landing_path", fallback: string) {
  const properties = (row?.properties ?? {}) as Record<string, unknown>;
  if (key === "source") {
    return cleanTrafficValue(row?.source ?? properties.traffic_source ?? properties.utm_source ?? properties.source, fallback).toLowerCase();
  }
  if (key === "campaign") {
    return cleanTrafficValue(row?.campaign ?? properties.utm_campaign ?? properties.campaign, fallback);
  }
  return cleanTrafficValue(row?.landing_path ?? properties.landing_path ?? properties.page_path, fallback);
}

function incrementMap(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function sortedTrafficRows<T extends { events?: number; orders?: number; sessions?: number }>(rows: T[], limit: number) {
  return rows
    .sort((a, b) => (b.orders ?? 0) - (a.orders ?? 0) || (b.sessions ?? 0) - (a.sessions ?? 0) || (b.events ?? 0) - (a.events ?? 0))
    .slice(0, limit);
}

function dataHygieneStatus(value: number | null, failAt: number, warnAt = 1): CheckStatus {
  if (value === null) return "warn";
  if (value >= failAt) return "fail";
  if (value >= warnAt) return "warn";
  return "pass";
}

function getKoreanDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function CheckCard({ check }: { check: SecurityCheck }) {
  return (
    <article className="adm-security-check">
      <div className={statusClass(check.status)}>
        {statusIcon(check.status)}
        <span>{STATUS_LABELS[check.status]}</span>
      </div>
      <div>
        <h3>{check.label}</h3>
        <strong>{check.summary}</strong>
        <p>{check.detail}</p>
      </div>
    </article>
  );
}

export default async function AdminSecurityPage() {
  const cookieStore = await cookies();
  const currentSessionValid = verifyAdminSessionToken(cookieStore.get("admin_session")?.value, process.env.ADMIN_SESSION_SECRET);
  const securityData = await loadSecurityData();
  const envChecks: SecurityCheck[] = [
    secretCheck("관리자 비밀번호", process.env.ADMIN_PASSWORD, 12, "관리자 로그인에 사용하는 비밀번호입니다. 운영에서는 충분히 긴 비밀번호를 사용해야 합니다."),
    secretCheck("관리자 세션 서명키", process.env.ADMIN_SESSION_SECRET, 32, "관리자 쿠키 세션을 서명하는 서버 전용 키입니다."),
    envFlag("Supabase URL", process.env.NEXT_PUBLIC_SUPABASE_URL, true, "운영 DB 연결에 필요한 공개 URL입니다. 값 자체는 화면에 표시하지 않습니다."),
    secretCheck("Supabase service role key", process.env.SUPABASE_SERVICE_ROLE_KEY, 32, "서버에서만 사용하는 DB 관리자 키입니다. 클라이언트로 노출되면 안 됩니다."),
    adminAllowedIpsCheck(),
    envFlag("관리자 API key", process.env.ADMIN_API_KEY, false, "브라우저 관리자 화면은 쿠키 세션을 사용합니다. 외부 자동화가 필요할 때만 별도로 사용합니다."),
    envFlag("Cron secret", process.env.CRON_SECRET, false, "예약 알림 등 cron 엔드포인트 보호에 사용하는 선택 설정입니다."),
    envFlag("Toss webhook secret", process.env.TOSS_WEBHOOK_SECRET, false, "카드/간편결제 webhook을 다시 활성화할 때 필요한 서명 검증 키입니다.")
  ];
  const runtimeChecks: SecurityCheck[] = [
    {
      label: "현재 관리자 세션",
      status: currentSessionValid ? "pass" : "fail",
      summary: currentSessionValid ? "유효함" : "확인 실패",
      detail: `관리자 세션은 최대 ${Math.floor(ADMIN_SESSION_MAX_AGE_SECONDS / 3600)}시간 동안 유지됩니다.`
    },
    {
      label: "관리자 라우트 보호",
      status: "pass",
      summary: "/admin/* 인증 필요",
      detail: "middleware에서 로그인 페이지를 제외한 관리자 경로를 세션 쿠키로 보호합니다."
    },
    {
      label: "관리자 색인 차단",
      status: "pass",
      summary: "noindex 적용",
      detail: "관리자 레이아웃은 robots noindex/follow false를 사용하고, robots.txt에서도 /admin/을 차단합니다."
    },
    {
      label: "헬스체크 공개 정보",
      status: "pass",
      summary: "환경 구성값 비노출",
      detail: "/api/health는 설정 여부나 결제 mock 상태를 외부에 노출하지 않습니다."
    },
    {
      label: "사진확인 이미지 입력",
      status: "pass",
      summary: "임시 업로드 경로만 허용",
      detail: "/api/diagnoses는 외부 이미지 URL을 받지 않고, 업로드 API가 만든 diagnoses/temp 경로만 서명합니다."
    },
    {
      label: "미취급 견적 URL",
      status: "pass",
      summary: "공개 진입 차단",
      detail: "현재 취급하지 않는 전등/콘센트 견적 URL은 사이트맵에서 제외하고 404로 처리합니다."
    }
  ];
  const dataChecks: SecurityCheck[] = [
    {
      label: "테스트 주문 잔여",
      status: dataHygieneStatus(securityData.counts.testOrders.value, 10),
      summary: countText(securityData.counts.testOrders),
      detail: "운영 DB에 테스트 주문이 많으면 실제 접수와 섞일 수 있습니다."
    },
    {
      label: "테스트 사진확인 잔여",
      status: dataHygieneStatus(securityData.counts.testDiagnoses.value, 10),
      summary: countText(securityData.counts.testDiagnoses),
      detail: "사진확인 테스트 데이터도 운영 접수와 분리되어야 합니다."
    },
    {
      label: "휴지통 주문",
      status: dataHygieneStatus(securityData.counts.trashedOrders.value, 50, 20),
      summary: countText(securityData.counts.trashedOrders),
      detail: "휴지통은 복구 가능 상태입니다. 장기간 누적되면 주기적으로 완전 삭제 여부를 검토하세요."
    },
    {
      label: "관리자 로그인 로그",
      status: "warn",
      summary: "DB 저장 미연결",
      detail: "현재 로그인 실패/성공은 rate limit으로 보호되지만 별도 보안 로그 테이블에는 저장하지 않습니다."
    }
  ];
  const allChecks = [...envChecks, ...runtimeChecks, ...dataChecks];
  const passCount = allChecks.filter((check) => check.status === "pass").length;
  const warnCount = allChecks.filter((check) => check.status === "warn").length;
  const failCount = allChecks.filter((check) => check.status === "fail").length;
  const overallStatus: CheckStatus = failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass";

  return (
    <>
      <header className="adm-page-header">
        <p className="adm-page-sub">읽기 전용 보안 점검판</p>
        <h1 className="adm-page-title">보안 점검</h1>
        <p className="adm-page-sub">비밀값은 표시하지 않고 운영에 필요한 보안 상태만 확인합니다.</p>
      </header>

      <section className="adm-content adm-stack">
        <section className="adm-security-hero adm-card">
          <div className="adm-security-hero-main">
            <span className={statusClass(overallStatus)}>
              {statusIcon(overallStatus)}
              <span>{STATUS_LABELS[overallStatus]}</span>
            </span>
            <h2>운영 보안 상태</h2>
            <p>
              실패 {failCount}개, 주의 {warnCount}개, 정상 {passCount}개입니다. 설정값 자체는 노출하지 않고 상태만 점검합니다.
            </p>
          </div>
          <div className="adm-security-hero-side">
            <span>마지막 확인</span>
            <strong>{getKoreanDateTime(securityData.lastUpdated)}</strong>
            <small>서버 렌더링 기준</small>
          </div>
        </section>

        <section className="adm-kpi-grid">
          <article className="adm-kpi-card">
            <div className="adm-kpi-label">최근 주문</div>
            <div className="adm-kpi-value">{countText(securityData.counts.recentOrders)}</div>
            <div className="adm-kpi-sub">{countSub(securityData.counts.recentOrders, "최근 24시간 운영 주문")}</div>
          </article>
          <article className="adm-kpi-card">
            <div className="adm-kpi-label">사진확인 접수</div>
            <div className="adm-kpi-value">{countText(securityData.counts.recentDiagnoses)}</div>
            <div className="adm-kpi-sub">{countSub(securityData.counts.recentDiagnoses, "최근 24시간 운영 접수")}</div>
          </article>
          <article className="adm-kpi-card">
            <div className="adm-kpi-label">이벤트 요청</div>
            <div className="adm-kpi-value">{countText(securityData.counts.recentEvents)}</div>
            <div className="adm-kpi-sub">{countSub(securityData.counts.recentEvents, "최근 24시간 전체 이벤트")}</div>
          </article>
          <article className="adm-kpi-card">
            <div className="adm-kpi-label">주문조회 이벤트</div>
            <div className="adm-kpi-value">{countText(securityData.counts.recentLookups)}</div>
            <div className="adm-kpi-sub">{countSub(securityData.counts.recentLookups, "최근 24시간 조회 이벤트")}</div>
          </article>
        </section>

        <section className="adm-card adm-section">
          <div className="adm-section-head">
            <div>
              <h2 className="adm-section-title">최근 유입경로</h2>
              <p className="adm-section-note adm-muted">
                최근 7일 기준입니다. 이벤트 {securityData.traffic.eventRowsChecked.toLocaleString("ko-KR")}건, 주문 {securityData.traffic.orderRowsChecked.toLocaleString("ko-KR")}건을 확인했습니다.
              </p>
            </div>
            <Link className="adm-btn adm-btn-secondary adm-btn-sm" href="/admin/analytics">
              운영 분석 보기
            </Link>
          </div>
          <div className="adm-security-traffic-grid">
            {securityData.traffic.sources.length === 0 ? (
              <article className="adm-security-traffic-empty">
                <strong>유입 데이터 없음</strong>
                <p>아직 최근 유입 이벤트가 없거나 Supabase 연결을 확인하지 못했습니다.</p>
              </article>
            ) : (
              securityData.traffic.sources.map((source) => (
                <article className="adm-security-traffic-card" key={source.key}>
                  <span>{trafficSourceLabel(source.key)}</span>
                  <strong>{source.orders.toLocaleString("ko-KR")}건</strong>
                  <small>세션 {source.sessions.toLocaleString("ko-KR")} · 이벤트 {source.events.toLocaleString("ko-KR")}</small>
                </article>
              ))
            )}
          </div>
          <div className="adm-security-traffic-tables">
            <div className="adm-table-wrap">
              <table className="adm-table">
                <caption className="adm-card-title">캠페인별 유입</caption>
                <thead><tr><th>캠페인</th><th>주문</th><th>이벤트</th></tr></thead>
                <tbody>
                  {securityData.traffic.campaigns.length === 0 ? (
                    <tr><td colSpan={3}>캠페인 데이터가 없습니다.</td></tr>
                  ) : (
                    securityData.traffic.campaigns.map((campaign) => (
                      <tr key={campaign.key}>
                        <td>{campaign.key}</td>
                        <td>{campaign.orders.toLocaleString("ko-KR")}건</td>
                        <td>{campaign.events.toLocaleString("ko-KR")}건</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <caption className="adm-card-title">랜딩 경로별 유입</caption>
                <thead><tr><th>경로</th><th>주문</th><th>이벤트</th></tr></thead>
                <tbody>
                  {securityData.traffic.landings.length === 0 ? (
                    <tr><td colSpan={3}>랜딩 경로 데이터가 없습니다.</td></tr>
                  ) : (
                    securityData.traffic.landings.map((landing) => (
                      <tr key={landing.key}>
                        <td>{landing.key}</td>
                        <td>{landing.orders.toLocaleString("ko-KR")}건</td>
                        <td>{landing.events.toLocaleString("ko-KR")}건</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="adm-grid-2">
          <div className="adm-card">
            <div className="adm-section-head">
              <div>
                <h2 className="adm-section-title">환경변수 상태</h2>
                <p className="adm-section-note adm-muted">값은 숨기고 설정 여부와 최소 길이만 봅니다.</p>
              </div>
              <ShieldCheck aria-hidden="true" size={20} />
            </div>
            <div className="adm-security-list">
              {envChecks.map((check) => (
                <CheckCard check={check} key={check.label} />
              ))}
            </div>
          </div>

          <div className="adm-card">
            <div className="adm-section-head">
              <div>
                <h2 className="adm-section-title">공개 표면 점검</h2>
                <p className="adm-section-note adm-muted">외부에서 접근 가능한 경로와 API 노출 상태입니다.</p>
              </div>
              <ShieldCheck aria-hidden="true" size={20} />
            </div>
            <div className="adm-security-list">
              {runtimeChecks.map((check) => (
                <CheckCard check={check} key={check.label} />
              ))}
            </div>
          </div>
        </section>

        <section className="adm-card">
          <div className="adm-section-head">
            <div>
              <h2 className="adm-section-title">데이터 위생과 운영 위험</h2>
              <p className="adm-section-note adm-muted">테스트 데이터, 휴지통, 로그인 기록처럼 운영 중 헷갈릴 수 있는 항목입니다.</p>
            </div>
            <Link className="adm-btn adm-btn-secondary adm-btn-sm" href="/admin/orders?testMode=true">
              테스트 주문 보기
            </Link>
          </div>
          <div className="adm-security-grid">
            {dataChecks.map((check) => (
              <CheckCard check={check} key={check.label} />
            ))}
          </div>
        </section>

        <section className="adm-card adm-security-followup">
          <h2 className="adm-section-title">다음 보안 작업 후보</h2>
          <div className="adm-security-followup-grid">
            <article>
              <strong>관리자 로그인 감사 로그</strong>
              <p>로그인 성공, 실패, rate limit 발생을 별도 테이블에 저장하면 운영자가 실제 침입 시도를 추적할 수 있습니다.</p>
            </article>
            <article>
              <strong>IP/세션 기반 이상 징후</strong>
              <p>짧은 시간 주문조회나 사진접수 실패가 급증하면 관리자 화면에서 경고를 띄울 수 있습니다.</p>
            </article>
            <article>
              <strong>운영 키 교체 체크리스트</strong>
              <p>Supabase service role, 관리자 세션키, webhook secret을 주기적으로 교체하는 절차를 문서화하면 좋습니다.</p>
            </article>
          </div>
        </section>
      </section>
    </>
  );
}
