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

function photoCount(order: any) {
  const diagnosisPhotos = Array.isArray(order?.photos) ? order.photos : [];
  const diagnosisImageUrls = Array.isArray(order?.image_urls) ? order.image_urls : [];
  const orderPhotos = Array.isArray(order?.inquiry_photos) ? order.inquiry_photos : [];
  const mediaPhotos = Array.isArray(order?.media)
    ? order.media.filter((item: any) => item.type === "inquiry").map((item: any) => item.file_path)
    : [];
  return [...new Set([...diagnosisPhotos, ...diagnosisImageUrls, ...orderPhotos, ...mediaPhotos].filter((item): item is string => typeof item === "string" && item.length > 0))].length;
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
  return maskName(order?.customer_name ?? order?.raw_response?.customer?.name ?? order?.customers?.name);
}

function firstServiceCode(order: any) {
  const sku = Array.isArray(order?.skus) ? order.skus[0] : null;
  return sku?.service_type_code ?? sku?.metadata?.service_type_code ?? sku?.sku ?? order?.service_type_code ?? order?.service_code;
}

function diagnosisOrderNumber(diagnosis: any) {
  const order = asOne(diagnosis?.orders);
  return order?.order_number ?? diagnosis?.raw_response?.receipt_number ?? diagnosis?.raw_response?.order_number ?? diagnosis?.id?.slice(0, 8) ?? "-";
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
  if (status === "quoted" || status === "payment_pending" || status === "pending_product_payment" || status === "paid" || status === "product_paid") return "adm-badge-blue";
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
    supabase.from("orders").select("id", { count: "exact", head: true }).or("is_test.is.null,is_test.eq.false").is("deleted_at", null).gte("created_at", ranges.today.start).lt("created_at", ranges.today.end),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "done").gte("paid_at", ranges.today.start).lt("paid_at", ranges.today.end),
    supabase.from("jobs").select("id", { count: "exact", head: true }).in("status", VISIT_SCHEDULED_STATUSES).gte("scheduled_at", ranges.today.start).lt("scheduled_at", ranges.today.end),
    supabase.from("warranty_cases").select("id", { count: "exact", head: true }).gte("created_at", ranges.today.start).lt("created_at", ranges.today.end),
    supabase.from("payments").select("amount").eq("status", "done").gte("paid_at", week),
    supabase.from("diagnoses").select("id", { count: "exact", head: true }).or("is_test.is.null,is_test.eq.false").is("result", null),
    supabase.from("feedbacks").select("nps").not("nps", "is", null),
    supabase.from("quotes").select("id", { count: "exact", head: true }).is("accepted_at", null),
    supabase.from("orders").select("id", { count: "exact", head: true }).or("is_test.is.null,is_test.eq.false").is("deleted_at", null).eq("status", "issue"),
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
      jobs(id,technician_id,assigned_technician_name,status,scheduled_at,created_at)
    `
    )
    .is("deleted_at", null)
    .or("is_test.is.null,is_test.eq.false")
    .in("status", ["paid", "product_paid"])
    .order("created_at", { ascending: true })
    .limit(80);

  return (data ?? []).filter((order: any) => !hasActiveAssignedJob(order.jobs)).slice(0, 10);
}

async function getPaymentNeededOrders(supabase: SupabaseAdmin) {
  const { data } = await supabase
    .from("orders")
    .select(
      `
      id, order_number, status, created_at, service_type_code, skus, total_amount, online_payment_amount, onsite_payment_amount,
      customers(name,phone),
      payments(id,status,amount,provider,method,online_payment_amount,onsite_payment_amount,requested_at,created_at)
    `
    )
    .is("deleted_at", null)
    .or("is_test.is.null,is_test.eq.false")
    .in("status", ["payment_pending", "pending_product_payment"])
    .order("created_at", { ascending: true })
    .limit(10);

  return data ?? [];
}

async function getPhotoReviewOrders(supabase: SupabaseAdmin) {
  const { data } = await supabase
    .from("diagnoses")
    .select(
      `
      id, order_id, service_type_code, service_code, image_urls, photos, result, created_at,
      customer_name, customer_phone, raw_response,
      orders(order_number)
    `
    )
    .is("result", null)
    .or("is_test.is.null,is_test.eq.false")
    .order("created_at", { ascending: true })
    .limit(10);

  return data ?? [];
}

async function getTomorrowUnassignedVisits(supabase: SupabaseAdmin, ranges: DashboardRanges) {
  const { data } = await supabase
    .from("jobs")
    .select(
      `
      id, order_id, technician_id, assigned_technician_name, scheduled_at, status, created_at,
      orders(
        id, order_number, status, created_at, service_type_code, skus, is_test,
        customers(name,phone)
      )
    `
    )
    .in("status", ACTIVE_JOB_STATUSES)
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", ranges.tomorrow.start)
    .lt("scheduled_at", ranges.tomorrow.end)
    .order("scheduled_at", { ascending: true })
    .limit(80);

  return (data ?? [])
    .filter((job: any) => {
      const order = asOne(job.orders);
      return order?.is_test !== true && ["paid", "product_paid", "scheduled"].includes(String(order?.status)) && !job.technician_id && !job.assigned_technician_name;
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
        id, order_number, status, service_type_code, skus, is_test,
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

  const jobs = (data ?? []).filter((job: any) => asOne(job.orders)?.is_test !== true);
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
    .or("is_test.is.null,is_test.eq.false")
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
    paymentNeededOrders: [],
    photoReviewOrders: [],
    unassignedPaidOrders: [],
    tomorrowUnassignedVisits: [],
    jobs: { today: [], tomorrow: [] },
    warrantyCases: [],
    diagnoses: { total: 0, byResult: [], topServices: [] },
    reschedules: { count: 0, events: [] }
  };

  if (!hasSupabaseEnv()) return fallback;

  const supabase = getSupabaseAdmin();
  const ranges = dashboardRanges();
  const [summary, paymentNeededOrders, photoReviewOrders, unassignedPaidOrders, tomorrowUnassignedVisits, jobs, warrantyCases, diagnoses, reschedules] = await Promise.all([
    getTodaySummary(supabase, ranges),
    getPaymentNeededOrders(supabase),
    getPhotoReviewOrders(supabase),
    getUnassignedPaidOrders(supabase),
    getTomorrowUnassignedVisits(supabase, ranges),
    getTodayTomorrowJobs(supabase, ranges),
    getTodayWarrantyCases(supabase, ranges),
    getRecentDiagnoses(supabase, ranges),
    getTodayRescheduleEvents(supabase, ranges)
  ]);

  return { ranges, summary, paymentNeededOrders, photoReviewOrders, unassignedPaidOrders, tomorrowUnassignedVisits, jobs, warrantyCases, diagnoses, reschedules };
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="adm-muted adm-empty-line">{children}</p>;
}

function localEmptyText(localMode: boolean, fallback: string, localMessage: string) {
  return localMode ? localMessage : fallback;
}

function OrderVisitMeta({ order }: { order: any }) {
  const activeJob = asArray(order?.jobs)
    .filter((job) => job.status !== "cancelled")
    .sort((a, b) => String(b.scheduled_at ?? b.created_at ?? "").localeCompare(String(a.scheduled_at ?? a.created_at ?? "")))[0];
  if (!activeJob?.scheduled_at) return <span>방문 일정 없음</span>;
  return <span>{kstDateOnly(activeJob.scheduled_at)} {slotFromScheduledAt(activeJob.scheduled_at)}</span>;
}

function JobList({ jobs, localMode = false }: { jobs: any[]; localMode?: boolean }) {
  if (jobs.length === 0) return <EmptyRow>{localEmptyText(localMode, "방문 일정이 없습니다.", "로컬 확인 모드에서는 방문 일정을 불러오지 않습니다.")}</EmptyRow>;
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
  const localMode = !hasSupabaseEnv();
  const data = await getDashboardData();
  const workflowCards = [
    {
      step: "1",
      label: "사진확인 접수",
      value: data.photoReviewOrders.length,
      sub: "확인 대기",
      href: "/admin/diagnoses"
    },
    {
      step: "2",
      label: "제품 주문",
      value: data.paymentNeededOrders.length + data.unassignedPaidOrders.length,
      sub: "입금/배정 확인",
      href: "/admin/orders"
    },
    {
      step: "3",
      label: "일정관리",
      value: data.jobs.today.length + data.jobs.tomorrow.length,
      sub: "오늘/내일 방문",
      href: "/admin/slots"
    }
  ];

  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">운영 대시보드</h1>
        <p className="adm-page-sub">KST {data.ranges.todayDate} 기준 사진확인, 제품 주문, 방문 일정만 먼저 확인합니다.</p>
      </header>
      <div className="adm-content">
        {localMode ? (
          <section className="adm-card adm-admin-warning" role="status">
            <strong>로컬 확인 모드입니다.</strong>
            <p>Supabase 연결 전에는 대시보드가 읽기 전용 기본 상태로 표시됩니다.</p>
          </section>
        ) : null}
        <section className="adm-section adm-card">
          <div className="adm-section-head">
            <div>
              <h2 className="adm-card-title">오늘 확인할 메뉴</h2>
              <p className="adm-muted adm-section-note">운영자가 바로 들어가서 처리할 메뉴만 남겼습니다.</p>
            </div>
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
                <h2 className="adm-card-title">사진확인 접수</h2>
                <Link className="adm-link" href="/admin/diagnoses">사진 확인</Link>
              </div>
              {data.photoReviewOrders.length === 0 ? (
                <EmptyRow>{localEmptyText(localMode, "확인할 사진 접수가 없습니다.", "로컬 확인 모드에서는 사진확인 접수 목록을 불러오지 않습니다.")}</EmptyRow>
              ) : (
                <div className="adm-action-list">
                  {data.photoReviewOrders.slice(0, 6).map((diagnosis: any) => (
                    <Link className="adm-action-row" href={`/admin/diagnoses?result=all&id=${diagnosis.id}`} key={diagnosis.id}>
                      <span>
                        <strong>{diagnosisOrderNumber(diagnosis)}</strong>
                        <small>{customerName(diagnosis)} · {formatServiceName(firstServiceCode(diagnosis))} · 사진 {photoCount(diagnosis)}장</small>
                      </span>
                      <span>
                        <small>{formatKRDateTime(diagnosis.created_at)}</small>
                        <b className={`adm-badge ${badgeClass(diagnosis.result)}`}>{resultLabel(diagnosis.result)}</b>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </article>

            <article className="adm-card">
              <div className="adm-section-head">
                <h2 className="adm-card-title">입금 확인 필요</h2>
                <Link className="adm-link" href="/admin/orders?flow=payment">입금 확인</Link>
              </div>
              {data.paymentNeededOrders.length === 0 ? (
                <EmptyRow>{localEmptyText(localMode, "입금 확인이 필요한 주문이 없습니다.", "로컬 확인 모드에서는 입금 확인 대상 주문을 불러오지 않습니다.")}</EmptyRow>
              ) : (
                <div className="adm-action-list">
                  {data.paymentNeededOrders.map((order: any) => (
                    <Link className="adm-action-row" href={`/admin/orders/${order.id}`} key={order.id}>
                      <span>
                        <strong>{order.order_number}</strong>
                        <small>{customerName(order)} · {formatServiceName(firstServiceCode(order))}</small>
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
                <h2 className="adm-card-title">입금 완료 후 미배정</h2>
                <Link className="adm-link" href="/admin/orders?status=paid">제품 주문</Link>
              </div>
              {data.unassignedPaidOrders.length === 0 ? (
                <EmptyRow>{localEmptyText(localMode, "미배정 paid 주문이 없습니다.", "로컬 확인 모드에서는 미배정 제품 주문을 불러오지 않습니다.")}</EmptyRow>
              ) : (
                <div className="adm-action-list">
                  {data.unassignedPaidOrders.map((order: any) => (
                    <Link className="adm-action-row" href={`/admin/orders/${order.id}`} key={order.id}>
                      <span>
                        <strong>{order.order_number}</strong>
                        <small>{customerName(order)} · <OrderVisitMeta order={order} /></small>
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
              {data.tomorrowUnassignedVisits.length === 0 ? (
                <EmptyRow>{localEmptyText(localMode, "내일 방문 예정 중 기사 미배정 건이 없습니다.", "로컬 확인 모드에서는 내일 방문 예정 배정 목록을 불러오지 않습니다.")}</EmptyRow>
              ) : (
                <div className="adm-action-list">
                  {data.tomorrowUnassignedVisits.map((job: any) => {
                    const order = asOne(job.orders);
                    return (
                      <Link className="adm-action-row" href={order?.id ? `/admin/orders/${order.id}` : "/admin/orders"} key={job.id}>
                        <span>
                          <strong>{order?.order_number ?? "-"}</strong>
                          <small>{customerName(order)} · {kstTimeLabel(job.scheduled_at)} · {slotFromScheduledAt(job.scheduled_at)}</small>
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
              <Link className="adm-link" href="/admin/slots">일정관리</Link>
            </div>
            <div className="adm-visit-columns">
              <section>
                <h3 className="adm-section-title">오늘 방문</h3>
              <JobList jobs={data.jobs.today} localMode={localMode} />
              </section>
              <section>
                <h3 className="adm-section-title">내일 방문</h3>
              <JobList jobs={data.jobs.tomorrow} localMode={localMode} />
              </section>
            </div>
          </article>
        </section>

      </div>
    </>
  );
}
