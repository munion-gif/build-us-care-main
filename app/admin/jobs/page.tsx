import Link from "next/link";
import { JobActions } from "./jobs-client";
import { formatOrderStatus, formatServiceName } from "@/lib/format";
import { maskAddress } from "@/lib/pii";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ date?: string }> };

function kstDate(offset = 0) {
  const date = new Date();
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(kst.getUTCDate() + offset);
  return kst.toISOString().slice(0, 10);
}

function kstDayRange(date: string) {
  const start = new Date(`${date}T00:00:00+09:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

async function getJobs(date: string) {
  if (!hasSupabaseEnv()) return [];
  const { from, to } = kstDayRange(date);
  const { data } = await getSupabaseAdmin()
    .from("jobs")
    .select("*, orders(id,order_number,status,service_type_code,skus,homes(address_full)), technicians(name)")
    .gte("scheduled_at", from)
    .lt("scheduled_at", to)
    .order("scheduled_at", { ascending: true });
  return data ?? [];
}

async function getMaterials() {
  if (!hasSupabaseEnv()) return [];
  const { data } = await getSupabaseAdmin().from("materials").select("sku,name").eq("is_active", true).order("name", { ascending: true });
  return data ?? [];
}

async function getTechnicianCount() {
  if (!hasSupabaseEnv()) return 0;
  const { count } = await getSupabaseAdmin().from("technicians").select("id", { count: "exact", head: true });
  return count ?? 0;
}

function firstServiceCode(order: any) {
  const sku = Array.isArray(order?.skus) ? order.skus[0] : null;
  return sku?.service_type_code ?? sku?.sku ?? order?.service_type_code;
}

function jobTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function jobBadgeClass(status?: string | null) {
  if (status === "scheduled" || status === "assigned") return "adm-badge-sky";
  if (status === "checked_in" || status === "in_progress") return "adm-badge-orange";
  if (status === "done" || status === "completed") return "adm-badge-green";
  if (status === "inspected") return "adm-badge-darkgreen";
  if (status === "issue" || status === "cancelled") return "adm-badge-red";
  return "adm-badge-gray";
}

function jobStage(status?: string | null) {
  if (status === "checked_in" || status === "in_progress") return "active";
  if (status === "done" || status === "completed") return "complete";
  if (status === "inspected") return "inspected";
  return "ready";
}

function isLateStart(job: any) {
  if (!["scheduled", "assigned", "received", "material_ready"].includes(String(job.status))) return false;
  if (!job.scheduled_at) return false;
  return new Date(job.scheduled_at).getTime() + 10 * 60 * 1000 < Date.now();
}

function addressPreview(job: any) {
  const address = job.orders?.homes?.address_full;
  return address ? maskAddress(address, 3) : "주소 확인 필요";
}

function JobCard({ job, materials }: { job: any; materials: any[] }) {
  const late = isLateStart(job);
  return (
    <article className="adm-job-card">
      <div className="adm-job-time">
        <strong>{jobTime(job.scheduled_at)}</strong>
        <span className={`adm-badge ${late ? "adm-badge-red" : jobBadgeClass(job.status)}`}>{late ? "시작 지연" : formatOrderStatus(job.status)}</span>
      </div>
      <div className="adm-job-main">
        <Link className="adm-link" href={job.orders?.id ? `/admin/orders/${job.orders.id}` : "/admin/orders"}>
          {job.orders?.order_number ?? "주문 확인"}
        </Link>
        <strong>{formatServiceName(firstServiceCode(job.orders))}</strong>
        <p>{job.technicians?.name ?? job.assigned_technician_name ?? "기사 미배정"} · {addressPreview(job)}</p>
      </div>
      <JobActions job={job} materials={materials} isLate={late} />
    </article>
  );
}

export default async function AdminJobsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const date = params.date ?? kstDate(0);
  const [jobs, materials, technicianCount] = await Promise.all([getJobs(date), getMaterials(), getTechnicianCount()]);
  const groups = {
    ready: jobs.filter((job: any) => jobStage(job.status) === "ready"),
    active: jobs.filter((job: any) => jobStage(job.status) === "active"),
    complete: jobs.filter((job: any) => jobStage(job.status) === "complete"),
    inspected: jobs.filter((job: any) => jobStage(job.status) === "inspected")
  };
  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">현장 관리</h1>
        <p className="adm-page-sub">시공 시작, 완료, 검수와 현장 사진을 기록합니다.</p>
      </header>
      <div className="adm-content">
        <nav className="adm-filter-bar">
          <a className="adm-btn adm-btn-secondary" href={`/admin/jobs?date=${kstDate(-1)}`}>어제</a>
          <a className="adm-btn adm-btn-secondary" href={`/admin/jobs?date=${kstDate(0)}`}>오늘</a>
          <a className="adm-btn adm-btn-secondary" href={`/admin/jobs?date=${kstDate(1)}`}>내일</a>
          <form className="adm-inline-form">
            <input className="adm-filter-input" name="date" type="date" defaultValue={date} />
            <button className="adm-btn adm-btn-primary">이동</button>
          </form>
        </nav>
        <section className="adm-queue-summary adm-section">
          <article><strong>{jobs.length}</strong><span>전체 현장</span></article>
          <article><strong>{groups.ready.length}</strong><span>방문 대기</span></article>
          <article><strong>{groups.active.length}</strong><span>진행 중</span></article>
          <article><strong>{groups.complete.length}</strong><span>완료 보고</span></article>
        </section>
        {technicianCount === 0 && (
          <section className="adm-card adm-section">
            <p className="adm-muted">등록된 기사가 없습니다. 기사 관리에서 먼저 추가해주세요.</p>
            <a className="adm-btn adm-btn-primary adm-btn-sm" href="/admin/technicians">기사 관리로 이동</a>
          </section>
        )}
        <section className="adm-job-board" aria-label="현장 진행판">
          {[
            ["ready", "방문 대기", "시작 전 확인", groups.ready],
            ["active", "진행 중", "완료 보고 대기", groups.active],
            ["complete", "완료 보고", "검수 필요", groups.complete],
            ["inspected", "검수 완료", "마감된 현장", groups.inspected]
          ].map(([key, title, subtitle, rows]) => (
            <section className="adm-job-column" key={String(key)}>
              <div className="adm-job-column-head">
                <strong>{String(title)}</strong>
                <small>{String(subtitle)} · {(rows as any[]).length}건</small>
              </div>
              {(rows as any[]).length === 0 ? (
                <p className="adm-muted adm-empty-line">해당 현장이 없습니다.</p>
              ) : (
                (rows as any[]).map((job) => <JobCard job={job} materials={materials} key={job.id} />)
              )}
            </section>
          ))}
        </section>
      </div>
    </>
  );
}
