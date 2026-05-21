import { EVENT_TYPES } from "@/lib/event-types";
import { formatKRDate } from "@/lib/format";
import { measure } from "@/lib/perf";
import { maskName, maskPhone } from "@/lib/pii";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function sinceWeek() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function percent(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 1000) / 10}%`;
}

function diagnosisResultLabel(result?: string | null) {
  const labels: Record<string, string> = {
    replace_recommended: "교체추천",
    replacement_recommended: "교체추천",
    no_replacement_needed: "교체불필요",
    not_needed: "교체불필요",
    hold: "보류",
    site_check_required: "현장확인필요"
  };
  return labels[result ?? ""] ?? result ?? "대기";
}

async function getAnalytics() {
  const fallback = {
    orders: { total: 0, paid: 0, conversionRate: "0%" },
    diagnoses: { total: 0, byResult: { 교체추천: 0, 교체불필요: 0, 보류: 0, 현장확인필요: 0 } },
    funnel: { diagnosisRequested: 0, quoteStarted: 0, quoteSubmitted: 0, paymentCompleted: 0, quoteStartRate: "0%", quoteSubmitRate: "0%", paymentCompletionRate: "0%" },
    warrantyExpiringSoon: { count: 0, orders: [] as Array<{ orderNumber: string; customerName: string; phone: string; completedAt: string }> }
  };
  if (!hasSupabaseEnv()) return fallback;

  const since = sinceWeek();
  const supabase = getSupabaseAdmin();
  const { data: configs } = await measure("admin.analytics.fetchWarrantyConfig", () => supabase.from("app_configs").select("key,value").in("key", ["warranty_period_days", "warranty_reminder_days"]));
  const configMap = new Map((configs ?? []).map((row) => [row.key, row.value]));
  const warrantyDays = Number(configMap.get("warranty_period_days") ?? 365);
  const reminderDays = Number(configMap.get("warranty_reminder_days") ?? 30);
  const now = Date.now();
  const warrantyLower = new Date(now - warrantyDays * 24 * 60 * 60 * 1000).toISOString();
  const warrantyUpper = new Date(now - Math.max(warrantyDays - reminderDays, 0) * 24 * 60 * 60 * 1000).toISOString();

  const [orders, paidOrders, diagnoses, events, warrantyJobs] = await Promise.all([
    measure("admin.analytics.countOrders", () => supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", since)),
    measure("admin.analytics.countPaidOrders", () => supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid").gte("created_at", since)),
    measure("admin.analytics.fetchDiagnoses", () => supabase.from("diagnoses").select("result").gte("created_at", since)),
    measure("admin.analytics.fetchEvents", () => supabase
      .from("events")
      .select("event_type")
      .in("event_type", [
        EVENT_TYPES.QUOTE_STARTED,
        EVENT_TYPES.QUOTE_PAGE_VIEW,
        EVENT_TYPES.QUOTE_SUBMITTED,
        EVENT_TYPES.ORDER_CREATED,
        EVENT_TYPES.QUOTE_ACCEPTED,
        EVENT_TYPES.PAYMENT_COMPLETED,
        EVENT_TYPES.DIAGNOSIS_REQUESTED
      ])
      .gte("occurred_at", since)),
    measure("admin.analytics.fetchWarrantyJobs", () => supabase
      .from("jobs")
      .select("id,completed_at,orders(order_number,customers(name,phone))")
      .in("status", ["done", "inspected"])
      .not("completed_at", "is", null)
      .gt("completed_at", warrantyLower)
      .lt("completed_at", warrantyUpper)
      .order("completed_at", { ascending: true })
      .limit(10))
  ]);

  const diagnosisRows = diagnoses.data ?? [];
  const byResult: Record<string, number> = { 교체추천: 0, 교체불필요: 0, 보류: 0, 현장확인필요: 0 };
  for (const row of diagnosisRows as any[]) {
    const result = diagnosisResultLabel(row.result);
    byResult[result] = (byResult[result] ?? 0) + 1;
  }

  const eventRows = events.data ?? [];
  const diagnosisRequested = eventRows.filter((row: any) => row.event_type === EVENT_TYPES.DIAGNOSIS_REQUESTED).length;
  const quoteStarted = eventRows.filter((row: any) => [EVENT_TYPES.QUOTE_STARTED, EVENT_TYPES.QUOTE_PAGE_VIEW].includes(row.event_type)).length;
  const quoteSubmitted = eventRows.filter((row: any) => [EVENT_TYPES.QUOTE_SUBMITTED, EVENT_TYPES.ORDER_CREATED, EVENT_TYPES.QUOTE_ACCEPTED].includes(row.event_type)).length;
  const paymentCompleted = eventRows.filter((row: any) => row.event_type === EVENT_TYPES.PAYMENT_COMPLETED).length;

  return {
    orders: {
      total: orders.count ?? 0,
      paid: paidOrders.count ?? 0,
      conversionRate: percent(paidOrders.count ?? 0, orders.count ?? 0)
    },
    diagnoses: {
      total: diagnosisRows.length,
      byResult
    },
    funnel: {
      diagnosisRequested,
      quoteStarted,
      quoteSubmitted,
      paymentCompleted,
      quoteStartRate: percent(quoteStarted, diagnosisRequested),
      quoteSubmitRate: percent(quoteSubmitted, quoteStarted),
      paymentCompletionRate: percent(paymentCompleted, quoteSubmitted)
    },
    warrantyExpiringSoon: {
      count: warrantyJobs.data?.length ?? 0,
      orders: (warrantyJobs.data ?? []).map((job: any) => ({
        orderNumber: job.orders?.order_number ?? "-",
        customerName: maskName(job.orders?.customers?.name),
        phone: maskPhone(job.orders?.customers?.phone),
        completedAt: job.completed_at
      }))
    }
  };
}

export default async function AdminAnalyticsPage() {
  const data = await measure("admin.analytics.getAnalytics", () => getAnalytics());

  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">운영 분석</h1>
        <p className="adm-page-sub">이번 주 주문, 사진 판정, 결제 전환 데이터를 확인합니다.</p>
      </header>
      <div className="adm-content">
        <section className="adm-kpi-grid">
          <article className="adm-kpi-card"><div className="adm-kpi-label">신규 주문</div><div className="adm-kpi-value">{data.orders.total}</div><div className="adm-kpi-sub">건</div></article>
          <article className="adm-kpi-card"><div className="adm-kpi-label">결제 완료</div><div className="adm-kpi-value">{data.orders.paid}</div><div className="adm-kpi-sub">전환율 {data.orders.conversionRate}</div></article>
          <article className="adm-kpi-card"><div className="adm-kpi-label">사진 판정 요청</div><div className="adm-kpi-value">{data.diagnoses.total}</div><div className="adm-kpi-sub">건</div></article>
          <article className="adm-kpi-card"><div className="adm-kpi-label">결제 완료 이벤트</div><div className="adm-kpi-value">{data.funnel.paymentCompleted}</div><div className="adm-kpi-sub">{data.funnel.paymentCompletionRate}</div></article>
          <article className="adm-kpi-card"><div className="adm-kpi-label">A/S 만료 임박</div><div className="adm-kpi-value">{data.warrantyExpiringSoon.count}</div><div className="adm-kpi-sub">30일 내 만료 예정</div></article>
        </section>
        <section className="adm-card adm-section">
          <h2 className="adm-card-title">사진 판정 결과</h2>
          <div className="adm-kpi-grid">
            {Object.entries(data.diagnoses.byResult).map(([label, value]) => (
              <article className="adm-kpi-card" key={label}>
                <div className="adm-kpi-label">{label}</div>
                <div className="adm-kpi-value">{value}</div>
                <div className="adm-kpi-sub">{percent(value, data.diagnoses.total)}</div>
              </article>
            ))}
          </div>
        </section>
        <section className="adm-table-wrap">
          <table className="adm-table">
            <caption className="adm-card-title">퍼널 전환</caption>
            <thead><tr><th>단계</th><th>건수</th><th>전환율</th></tr></thead>
            <tbody>
              <tr><td>사진 판정 요청</td><td>{data.funnel.diagnosisRequested}</td><td>-</td></tr>
              <tr><td>견적 시작</td><td>{data.funnel.quoteStarted}</td><td>{data.funnel.quoteStartRate}</td></tr>
              <tr><td>견적 제출</td><td>{data.funnel.quoteSubmitted}</td><td>{data.funnel.quoteSubmitRate}</td></tr>
              <tr><td>결제 완료</td><td>{data.funnel.paymentCompleted}</td><td>{data.funnel.paymentCompletionRate}</td></tr>
            </tbody>
          </table>
        </section>
        <section className="adm-table-wrap adm-section">
          <table className="adm-table">
            <caption className="adm-card-title">A/S 만료 임박 고객</caption>
            <thead><tr><th>주문번호</th><th>고객</th><th>전화번호</th><th>시공 완료일</th></tr></thead>
            <tbody>
              {data.warrantyExpiringSoon.orders.length === 0 ? (
                <tr><td colSpan={4}>A/S 만료 임박 고객이 없습니다.</td></tr>
              ) : (
                data.warrantyExpiringSoon.orders.map((order) => (
                  <tr key={`${order.orderNumber}-${order.completedAt}`}>
                    <td>{order.orderNumber}</td>
                    <td>{order.customerName}</td>
                    <td>{order.phone}</td>
                    <td>{formatKRDate(order.completedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
