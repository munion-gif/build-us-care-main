import { TechnicianActiveToggle, TechnicianCreateForm, TechnicianScheduleButton } from "./technicians-client";
import { formatServiceName } from "@/lib/format";
import { measure } from "@/lib/perf";
import { maskPhone } from "@/lib/pii";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getTechnicians() {
  if (!hasSupabaseEnv()) return [];
  const { data } = await getSupabaseAdmin().from("technicians").select("id,name,phone,region,type,grade,skills,experience_years,specialties,bio,profile_image_url,avg_nps,pass_rate,active_jobs_per_month,is_active,created_at").order("created_at", { ascending: false });
  return data ?? [];
}

function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return { start: monday.toISOString(), end: nextMonday.toISOString() };
}

async function getWeekAssignedCounts() {
  if (!hasSupabaseEnv()) return new Map<string, number>();
  const range = weekRange();
  const { data } = await getSupabaseAdmin()
    .from("jobs")
    .select("technician_id,status,scheduled_at")
    .not("technician_id", "is", null)
    .neq("status", "cancelled")
    .gte("scheduled_at", range.start)
    .lt("scheduled_at", range.end);
  const counts = new Map<string, number>();
  for (const job of data ?? []) {
    if (job.technician_id) counts.set(job.technician_id, (counts.get(job.technician_id) ?? 0) + 1);
  }
  return counts;
}

export default async function AdminTechniciansPage() {
  const [technicians, weekCounts] = await Promise.all([
    measure("admin.technicians.fetchTechnicians", () => getTechnicians()),
    measure("admin.technicians.fetchWeekCounts", () => getWeekAssignedCounts())
  ]);
  const activeCount = technicians.filter((tech: any) => tech.is_active).length;
  const weekAssignedTotal = [...weekCounts.values()].reduce((sum, value) => sum + value, 0);
  const inactiveCount = Math.max(technicians.length - activeCount, 0);

  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">기사 관리</h1>
        <p className="adm-page-sub">기사 역량, 담당 서비스, 품질 지표를 관리합니다.</p>
      </header>
      <div className="adm-content adm-stack">
        <section className="adm-section-head">
          <div>
            <h2 className="adm-card-title">기사 운영 현황</h2>
            <p className="adm-muted adm-section-note">활성 여부, 이번 주 배정량, 담당 서비스만 빠르게 확인합니다.</p>
          </div>
          <TechnicianCreateForm />
        </section>
        <section className="adm-queue-summary">
          <article><strong>{technicians.length}</strong><span>전체 기사</span></article>
          <article><strong>{activeCount}</strong><span>활성 기사</span></article>
          <article><strong>{weekAssignedTotal}</strong><span>이번 주 배정</span></article>
          <article><strong>{inactiveCount}</strong><span>비활성</span></article>
        </section>
        {technicians.length === 0 ? (
          <section className="adm-card adm-empty-line">등록된 기사가 없습니다.</section>
        ) : (
          <section className="adm-tech-grid" aria-label="기사 목록">
            {technicians.map((tech: any) => {
              const skills = Array.isArray(tech.skills) ? tech.skills : [];
              const specialties = Array.isArray(tech.specialties) ? tech.specialties : [];
              const weekCount = weekCounts.get(tech.id) ?? 0;
              return (
                <article className="adm-tech-card" key={tech.id}>
                  <div className="adm-tech-head">
                    <div>
                      <strong>{tech.name}</strong>
                      <p>{maskPhone(tech.phone)} · {tech.region ?? "담당 지역 미입력"}</p>
                    </div>
                    <TechnicianActiveToggle id={tech.id} active={Boolean(tech.is_active)} />
                  </div>
                  <div className="adm-tech-profile">
                    <span className="adm-badge adm-badge-gray">{tech.type ?? "유형 미입력"}</span>
                    <span className="adm-badge adm-badge-sky">{tech.grade ?? "등급 미입력"}</span>
                    <span>경력 {tech.experience_years ?? 0}년</span>
                  </div>
                  <p className="adm-tech-bio">{tech.bio || specialties.slice(0, 2).join(", ") || "소개와 전문 분야가 아직 입력되지 않았습니다."}</p>
                  <div className="adm-tech-metrics">
                    <span><b>NPS</b>{tech.avg_nps ? `${Number(tech.avg_nps).toFixed(1)} / 10` : "-"}</span>
                    <span><b>검수</b>{tech.pass_rate ? `${Number(tech.pass_rate).toFixed(0)}%` : "-"}</span>
                    <span><b>이번 달</b>{tech.active_jobs_per_month ?? 0}건</span>
                    <span><b>이번 주</b>{weekCount}건</span>
                  </div>
                  <div className="adm-tech-services">
                    {skills.length === 0 ? (
                      <span>담당 서비스 미입력</span>
                    ) : (
                      skills.slice(0, 5).map((skill: string) => <span key={skill}>{formatServiceName(skill)}</span>)
                    )}
                    {skills.length > 5 && <span>+{skills.length - 5}</span>}
                  </div>
                  <div className="adm-tech-actions">
                    <span className="adm-muted">남은 기준 슬롯 {Math.max(0, 14 - weekCount)}개</span>
                    <TechnicianScheduleButton id={tech.id} name={tech.name} />
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </>
  );
}
