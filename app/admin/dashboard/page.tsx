import Link from "next/link";
import { EVENT_TYPES } from "@/lib/event-types";
import { formatKRDateTime, formatOrderStatus, formatServiceName } from "@/lib/format";
import { maskAddress, maskName } from "@/lib/pii";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const ACTIVE_JOB_STATUSES = ["received", "material_ready", "assigned", "scheduled", "checked_in", "in_progress"];
const VISIT_SCHEDULED_STATUSES = ["scheduled"];

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

type DashboardRanges = {
  todayDate: string;
  tomorrowDate: string;
  today: { start: string; end: string };
  tomorrow: { start: string; end: string };
  recent24h: string;
};

type TodaySummary = {
  todayOrders: number;
  todayPaid: number;
  todayVisits: number;
  todayWarranty: number;
  weekRevenue: number;
  pendingDiagnoses: number;
  avgNps: number | null;
  pendingQuotes: number;
  issueOrders: number;
  weekCompletedJobs: number;
};

function kstDateText(offsetDays = 0) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kstNow.setUTCDate(kstNow.getUTCDate() + offsetDays);
  const year = kstNow.getUTCFullYear();
  const month = String(kstNow.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kstNow.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function kstDayUtcRange(dateText: string) {
  const start = new Date(`${dateText}T00:00:00+09:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function dashboardRanges(): DashboardRanges {
  const todayDate = kstDateText(0);
  const tomorrowDate = kstDateText(1);
  return {
    todayDate,
    tomorrowDate,
    today: kstDayUtcRange(todayDate),
    tomorrow: kstDayUtcRange(tomorrowDate),
    recent24h: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  };
}

function startOfWeekKst() {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kstNow.getUTCDay();
  const mondayDate = kstNow.getUTCDate() + (day === 0 ? -6 : 1 - day);
  return new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), mondayDate) - 9 * 60 * 60 * 1000).toISOString();
}

function asArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function asOne(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function hasActiveAssignedJob(jobs: any) {
  return asArray(jobs).some((job) => {
    if (!ACTIVE_JOB_STATUSES.includes(String(job.status))) return false;
    return Boolean(job.technician_id || job.assigned_technician_name);
  });
}

function slotLabel(slot?: string | null) {
  if (slot === "morning") return "오전";
  if (slot === "afternoon") return "오후";
  if (slot === "all_day") return "종일";
  return "-";
}

function kstTimeLabel(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function kstDateOnly(value?: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function slotFromScheduledAt(value?: string | null) {
  if (!value) return "-";
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(new Date(value)));
  return hour < 13 ? "오전" : "오후";
}

function addressSummary(order: any) {
  const homeAddress = order?.homes?.address_full;
  const address = asOne(order?.addresses);
  const fullAddress = homeAddress ?? [address?.road_address, address?.detail_address].filter(Boolean).join(" ");
  return maskAddress(fullAddress, 3);
}

function customerName(order: any) {
  return maskName(order?.customers?.name);
}

function resultLabel(result?: string | null) {
  const labels: Record<string, string> = {
    replace_recommended: "교체추천",
    no_replacement_needed: "교체불필요",
    hold: "보류",
    site_check_required: "현장확인필요"
  };
  return labels[result ?? ""] ?? result ?? "대기";
}

function badgeClass(status?: string | null) {
  if (status === "quoted" || status === "payment_pending" || status === "paid") return "adm-badge-blue";
  if (status === "scheduled" || status === "assigned") return "adm-badge-sky";
  if (status === "in_progress" || status === "checked_in") return "adm-badge-orange";
  if (status === "done" || status === "completed" || status === "inspected") return "adm-badge-green";
  if (status === "issue" || status === "open") return "adm-badge-red";
  if (status === "cancel_requested") return "adm-badge-orange";
  return "adm-badge-gray";
}

async function getTodaySummary(supabase: SupabaseAdmin, ranges: DashboardRanges): Promise<TodaySummary> {
  const week = startOfWeekKst();
  const [
    todayOrders,
    todayPaid,
    todayVisits,
    todayWarranty,
    weekPayments,
    pendingDiagnoses,
    feedbacks,
    pendingQuotes,
    issueOrders,
    weekCompletedJobs
  ] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", ranges.today.start).lt("created_at", ranges.today.end),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "done").gte("paid_at", ranges.today.start).lt("paid_at", ranges.today.end),
    supabase.from("jobs").select("id", { count: "exact", head: true }).in("status", VISIT_SCHEDULED_STATUSES).gte("scheduled_at", ranges.today.start).lt("scheduled_at", ranges.today.end),
    supabase.from("warranty_cases").select("id", { count: "exact", head: true }).gte("created_at", ranges.today.start).lt("created_at", ranges.today.end),
    supabase.from("payments").select("amount").eq("status", "done").gte("paid_at", week),
    supabase.from("diagnoses").select("id", { count: "exact", head: true }).is("result", null),
    supabase.from("feedbacks").select("nps").not("nps", "is", null),
    supabase.from("quotes").select("id", { count: "exact", head: true }).is("accepted_at", null),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "issue"),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "inspected").gte("ended_at", week)
  ]);

  const npsRows = feedbacks.data ?? [];
  return {
    todayOrders: todayOrders.count ?? 0,
    todayPaid: todayPaid.count ?? 0,
    todayVisits: todayVisits.count ?? 0,
    todayWarranty: todayWarranty.count ?? 0,
    weekRevenue: (weekPayments.data ?? []).reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0),
    pendingDiagnoses: pendingDiagnoses.count ?? 0,
    avgNps: npsRows.length ? Math.round((npsRows.reduce((sum: number, row: any) => sum + Number(row.nps ?? 0), 0) / npsRows.length) * 10) / 10 : null,
    pendingQuotes: pendingQuotes.count ?? 0,
    issueOrders: issueOrders.count ?? 0,
    weekCompletedJobs: weekCompletedJobs.count ?? 0
  };
}

async function getUnassignedPaidOrders(supabase: SupabaseAdmin) {
  const { data } = await supabase
    .from("orders")
    .select(
      `
      id, order_number, status, created_at, service_type_code, skus,
      customers(name,phone),
      reservations(id,reserved_date,time_slot,status,created_at),
      jobs(id,technician_id,assigned_technician_name,status,scheduled_at,created_at)
    `
    )
    .eq("status", "paid")
    .order("created_at", { ascending: true })
    .limit(80);

  return (data ?? []).filter((order: any) => !hasActiveAssignedJob(order.jobs)).slice(0, 10);
}

async function getTomorrowUnassignedReservations(supabase: SupabaseAdmin, tomorrowDate: string) {
  const { data } = await supabase
    .from("reservations")
    .select(
      `
      id, order_id, reserved_date, time_slot, status, created_at,
      orders(
        id, order_number, status, created_at, service_type_code, skus,
        customers(name,phone),
        jobs(id,technician_id,assigned_technician_name,status,scheduled_at,created_at)
      )
    `
    )
    .eq("reserved_date", tomorrowDate)
    .in("status", ["pending", "confirmed"])
    .order("created_at", { ascending: true })
    .limit(80);

  return (data ?? [])
    .filter((reservation: any) => {
      const order = asOne(reservation.orders);
      return ["paid", "scheduled"].includes(String(order?.status)) && !hasActiveAssignedJob(order?.jobs);
    })
    .slice(0, 10);
}

async function getTodayTomorrowJobs(supabase: SupabaseAdmin, ranges: DashboardRanges) {
  const { data } = await supabase
    .from("jobs")
    .select(
      `
      id, order_id, technician_id, assigned_technician_name, status, scheduled_at, scheduled_date, created_at,
      technicians(name),
      orders(
        id, order_number, status, service_type_code, skus,
        homes(address_full),
        addresses(road_address,detail_address)
      )
    `
    )
    .in("status", ACTIVE_JOB_STATUSES)
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", ranges.today.start)
    .lt("scheduled_at", ranges.tomorrow.end)
    .order("scheduled_at", { ascending: true })
    .limit(80);

  const jobs = data ?? [];
  return {
    today: jobs.filter((job: any) => kstDateOnly(job.scheduled_at) === ranges.todayDate),
    tomorrow: jobs.filter((job: any) => kstDateOnly(job.scheduled_at) === ranges.tomorrowDate)
  };
}

async function getTodayWarrantyCases(supabase: SupabaseAdmin, ranges: DashboardRanges) {
  const { data } = await supabase
    .from("warranty_cases")
    .select(
      `
      id, order_id, job_id, status, reason, issue_type, description, responsibility, created_at,
      orders(id,order_number),
      jobs(id,order_id,orders(id,order_number))
    `
    )
    .gte("created_at", ranges.today.start)
    .lt("created_at", ranges.today.end)
    .order("created_at", { ascending: false })
    .limit(10);
  return data ?? [];
}

async function getRecentDiagnoses(supabase: SupabaseAdmin, ranges: DashboardRanges) {
  const { data, count } = await supabase
    .from("diagnoses")
    .select("id,result,service_type_code,service_code,suggested_service_code,created_at", { count: "exact" })
    .gte("created_at", ranges.recent24h)
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = data ?? [];
  const byResult = new Map<string, number>();
  const byService = new Map<string, number>();
  for (const row of rows as any[]) {
    const result = resultLabel(row.result);
    byResult.set(result, (byResult.get(result) ?? 0) + 1);
    const service = formatServiceName(row.service_type_code ?? row.service_code ?? row.suggested_service_code);
    byService.set(service, (byService.get(service) ?? 0) + 1);
  }

  return {
    total: count ?? rows.length,
    byResult: [...byResult.entries()].sort((a, b) => b[1] - a[1]),
    topServices: [...byService.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  };
}

async function getTodayRescheduleEvents(supabase: SupabaseAdmin, ranges: DashboardRanges) {
  const { data, count } = await supabase
    .from("events")
    .select("id,order_id,properties,created_at,orders(id,order_number)", { count: "exact" })
    .eq("event_type", EVENT_TYPES.RESERVATION_RESCHEDULED)
    .gte("created_at", ranges.today.start)
    .lt("created_at", ranges.today.end)
    .order("created_at", { ascending: false })
    .limit(8);
  return { count: count ?? data?.length ?? 0, events: data ?? [] };
}

async function getDashboardData() {
  const fallback = {
    ranges: dashboardRanges(),
    summary: {
      todayOrders: 0,
      todayPaid: 0,
      todayVisits: 0,
      todayWarranty: 0,
      weekRevenue: 0,
      pendingDiagnoses: 0,
      avgNps: null,
      pendingQuotes: 0,
      issueOrders: 0,
      weekCompletedJobs: 0
    } satisfies TodaySummary,
    unassignedPaidOrders: [],
    tomorrowUnassignedReservations: [],
    jobs: { today: [], tomorrow: [] },
    warrantyCases: [],
    diagnoses: { total: 0, byResult: [], topServices: [] },
    reschedules: { count: 0, events: [] }
  };

  if (!hasSupabaseEnv()) return fallback;

  const supabase = getSupabaseAdmin();
  const ranges = dashboardRanges();
  const [summary, unassignedPaidOrders, tomorrowUnassignedReservations, jobs, warrantyCases, diagnoses, reschedules] = await Promise.all([
    getTodaySummary(supabase, ranges),
    getUnassignedPaidOrders(supabase),
    getTomorrowUnassignedReservations(supabase, ranges.tomorrowDate),
    getTodayTomorrowJobs(supabase, ranges),
    getTodayWarrantyCases(supabase, ranges),
    getRecentDiagnoses(supabase, ranges),
    getTodayRescheduleEvents(supabase, ranges)
  ]);

  return { ranges, summary, unassignedPaidOrders, tomorrowUnassignedReservations, jobs, warrantyCases, diagnoses, reschedules };
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="adm-muted adm-empty-line">{children}</p>;
}

function OrderReservationMeta({ order, reservation }: { order: any; reservation?: any }) {
  const reservations = asArray(order?.reservations).filter((item) => item.status !== "cancelled");
  const activeReservation = reservation ?? reservations.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
  if (!activeReservation) return <span>예약 없음</span>;
  return (
    <span>
      {activeReservation.reserved_date} {slotLabel(activeReservation.time_slot)}
    </span>
  );
}

function JobList({ jobs }: { jobs: any[] }) {
  if (jobs.length === 0) return <EmptyRow>방문 일정이 없습니다.</EmptyRow>;
  return (
    <div className="adm-action-list">
      {jobs.map((job) => {
        const order = asOne(job.orders);
        return (
          <Link className="adm-action-row" href={order?.id ? `/admin/orders/${order.id}` : "/admin/orders"} key={job.id}>
            <span>
              <strong>{kstTimeLabel(job.scheduled_at)} · {slotFromScheduledAt(job.scheduled_at)}</strong>
              <small>{job.technicians?.name ?? job.assigned_technician_name ?? "기사 미배정"} · {order?.order_number ?? "-"}</small>
            </span>
            <span>
              <small>{addressSummary(order)}</small>
              <b className={`adm-badge ${badgeClass(job.status)}`}>{formatOrderStatus(job.status)}</b>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const data = await getDashboardData();
  const workflowCards = [
    {
      step: "1",
      label: "신규 주문",
      value: data.summary.todayOrders,
      sub: "오늘 접수",
      href: "/admin/orders?flow=intake"
    },
    {
      step: "2",
      label: "결제 미배정",
      value: data.unassignedPaidOrders.length,
      sub: "결제 완료, 기사 미배정",
      href: "/admin/orders?flow=paid"
    },
    {
      step: "3",
      label: "방문",
      value: data.summary.todayVisits,
      sub: "오늘 방문 예정",
      href: "/admin/jobs"
    },
    {
      step: "4",
      label: "사진 확인",
      value: data.summary.pendingDiagnoses,
      sub: "사진접수 상담 필요",
      href: "/admin/diagnoses?result=all"
    },
    {
      step: "5",
      label: "취소/A/S",
      value: data.summary.todayWarranty + data.summary.issueOrders,
      sub: "예외 처리",
      href: "/admin/orders?flow=issue"
    }
  ];

  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">운영 대시보드</h1>
        <p className="adm-page-sub">KST {data.ranges.todayDate} 기준 신규 주문, 결제 미배정, 방문, 예외 처리를 우선 확인합니다.</p>
      </header>
      <div className="adm-content">
        <section className="adm-section adm-card">
          <div className="adm-section-head">
            <div>
              <h2 className="adm-card-title">오늘 처리 흐름</h2>
              <p className="adm-muted adm-section-note">보고용 지표보다 바로 처리할 업무만 우선 배치했습니다.</p>
            </div>
            <Link className="adm-link" href="/admin/analytics">분석 보기</Link>
          </div>
          <div className="adm-workflow-strip" aria-label="오늘 처리 흐름">
            {workflowCards.map((card) => (
              <Link className="adm-workflow-card" href={card.href} key={card.label}>
                <span className="adm-workflow-step">{card.step}</span>
                <strong>{card.label}</strong>
                <b>{card.value}</b>
                <small>{card.sub}</small>
              </Link>
            ))}
          </div>
        </section>

        <section className="adm-dashboard-grid adm-section">
          <div className="adm-stack">
            <article className="adm-card">
              <div className="adm-section-head">
                <h2 className="adm-card-title">미배정 paid 주문</h2>
                <Link className="adm-link" href="/admin/orders?status=paid">주문 관리</Link>
              </div>
              {data.unassignedPaidOrders.length === 0 ? (
                <EmptyRow>미배정 paid 주문이 없습니다.</EmptyRow>
              ) : (
                <div className="adm-action-list">
                  {data.unassignedPaidOrders.map((order: any) => (
                    <Link className="adm-action-row" href={`/admin/orders/${order.id}`} key={order.id}>
                      <span>
                        <strong>{order.order_number}</strong>
                        <small>{customerName(order)} · <OrderReservationMeta order={order} /></small>
                      </span>
                      <span>
                        <small>{formatKRDateTime(order.created_at)}</small>
                        <b className={`adm-badge ${badgeClass(order.status)}`}>{formatOrderStatus(order.status)}</b>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </article>

            <article className="adm-card">
              <div className="adm-section-head">
                <h2 className="adm-card-title">내일 방문 예정 · 기사 미배정</h2>
                <span className="adm-muted">{data.ranges.tomorrowDate}</span>
              </div>
              {data.tomorrowUnassignedReservations.length === 0 ? (
                <EmptyRow>내일 예약 중 기사 미배정 건이 없습니다.</EmptyRow>
              ) : (
                <div className="adm-action-list">
                  {data.tomorrowUnassignedReservations.map((reservation: any) => {
                    const order = asOne(reservation.orders);
                    return (
                      <Link className="adm-action-row" href={order?.id ? `/admin/orders/${order.id}` : "/admin/orders"} key={reservation.id}>
                        <span>
                          <strong>{order?.order_number ?? "-"}</strong>
                          <small>{customerName(order)} · {reservation.reserved_date} {slotLabel(reservation.time_slot)}</small>
                        </span>
                        <span>
                          <b className={`adm-badge ${badgeClass(order?.status)}`}>{formatOrderStatus(order?.status)}</b>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </article>
          </div>

          <article className="adm-card">
            <div className="adm-section-head">
              <h2 className="adm-card-title">오늘/내일 방문 일정</h2>
              <Link className="adm-link" href="/admin/jobs">현장 관리</Link>
            </div>
            <div className="adm-visit-columns">
              <section>
                <h3 className="adm-section-title">오늘 방문</h3>
                <JobList jobs={data.jobs.today} />
              </section>
              <section>
                <h3 className="adm-section-title">내일 방문</h3>
                <JobList jobs={data.jobs.tomorrow} />
              </section>
            </div>
          </article>
        </section>

        <section className="adm-dashboard-alerts adm-section" aria-label="운영 알림">
          <article className="adm-card">
            <div className="adm-section-head">
              <h2 className="adm-card-title">오늘 접수된 A/S</h2>
              <span className="adm-muted">{data.warrantyCases.length}건</span>
            </div>
            {data.warrantyCases.length === 0 ? (
              <EmptyRow>오늘 접수된 A/S가 없습니다.</EmptyRow>
            ) : (
              <div className="adm-action-list">
                {data.warrantyCases.map((item: any) => {
                  const order = asOne(item.orders) ?? asOne(asOne(item.jobs)?.orders);
                  return (
                    <Link className="adm-action-row" href={order?.id ? `/admin/orders/${order.id}` : "/admin/orders"} key={item.id}>
                      <span>
                        <strong>{item.id.slice(0, 8)} · {order?.order_number ?? "-"}</strong>
                        <small>{item.issue_type ?? item.reason ?? "유형 미확인"} · {item.description ?? "설명 없음"}</small>
                      </span>
                      <span>
                        <b className={`adm-badge ${badgeClass(item.status)}`}>{item.status ?? "open"}</b>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </article>

          <article className="adm-card">
            <div className="adm-section-head">
              <h2 className="adm-card-title">최근 24시간 사진 판정</h2>
              <Link className="adm-link" href="/admin/diagnoses">사진 판정</Link>
            </div>
            <div className="adm-big-number">{data.diagnoses.total}<span>건</span></div>
            <div className="adm-mini-metrics">
              {data.diagnoses.byResult.length === 0 ? (
                <EmptyRow>최근 사진 판정이 없습니다.</EmptyRow>
              ) : (
                data.diagnoses.byResult.map(([label, value]) => <span key={label}>{label} {value}</span>)
              )}
            </div>
            {data.diagnoses.topServices.length > 0 && (
              <div className="adm-mini-metrics adm-mini-metrics-muted">
                {data.diagnoses.topServices.map(([label, value]) => <span key={label}>{label} {value}</span>)}
              </div>
            )}
          </article>

          <article className="adm-card">
            <div className="adm-section-head">
              <h2 className="adm-card-title">오늘 예약 변경 수</h2>
              <span className="adm-muted">{data.reschedules.count}건</span>
            </div>
            {data.reschedules.events.length === 0 ? (
              <EmptyRow>오늘 예약 변경이 없습니다.</EmptyRow>
            ) : (
              <div className="adm-action-list">
                {data.reschedules.events.map((event: any) => {
                  const order = asOne(event.orders);
                  const props = event.properties ?? {};
                  return (
                    <Link className="adm-action-row" href={order?.id ? `/admin/orders/${order.id}` : "/admin/orders"} key={event.id}>
                      <span>
                        <strong>{order?.order_number ?? "주문 확인"}</strong>
                        <small>{props.from_date ?? "-"} {slotLabel(props.from_slot)} → {props.to_date ?? "-"} {slotLabel(props.to_slot)}</small>
                      </span>
                      <span><small>{formatKRDateTime(event.created_at)}</small></span>
                    </Link>
                  );
                })}
              </div>
            )}
          </article>
        </section>

      </div>
    </>
  );
}
