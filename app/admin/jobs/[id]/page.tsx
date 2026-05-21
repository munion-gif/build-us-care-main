import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { JobActions } from "../jobs-client";
import { formatKRDateTime, formatOrderStatus, formatServiceName } from "@/lib/format";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

function firstServiceCode(order: any) {
  const sku = Array.isArray(order?.skus) ? order.skus[0] : null;
  return sku?.service_type_code ?? sku?.sku ?? order?.service_type_code;
}

export default async function AdminJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  let job: any = null;
  let materials: any[] = [];
  if (hasSupabaseEnv()) {
    const supabase = getSupabaseAdmin();
    const [{ data }, { data: materialRows }] = await Promise.all([
      supabase
      .from("jobs")
      .select("*, technicians(*), orders(*, customers(*), homes(*)), media(*), inspections(*)")
      .eq("id", id)
      .maybeSingle(),
      supabase.from("materials").select("sku,name").eq("is_active", true).order("name", { ascending: true })
    ]);
    job = data;
    materials = materialRows ?? [];
  }
  if (!job) return <div>작업을 찾을 수 없어요.</div>;
  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">현장 상세</h1>
        <p className="adm-page-sub">{job.orders?.order_number ?? "-"} · {formatServiceName(firstServiceCode(job.orders))}</p>
      </header>
      <div className="adm-content adm-stack">
        <section className="adm-card">
          <h2 className="adm-card-title">현장 정보</h2>
          <p>상태: <span className="adm-badge adm-badge-sky">{formatOrderStatus(job.status)}</span></p>
          <p>기사: {job.technicians?.name ?? job.assigned_technician_name ?? "-"}</p>
          <p>주소: {job.orders?.homes?.address_full ?? "-"}</p>
          <p>방문 예정: {formatKRDateTime(job.scheduled_at)}</p>
          <p>예상/실제 시간: {job.expected_minutes ?? 0}분 / {job.actual_minutes ?? "-"}분</p>
          <p>완료 메모: {job.completion_notes ?? "-"}</p>
          <p>이슈: {job.issues ?? "-"}</p>
        </section>
        <section className="adm-card">
          <h2 className="adm-card-title">현장 액션</h2>
          <JobActions job={job} materials={materials}/>
        </section>
        <section className="adm-card">
          <h2 className="adm-card-title">시공 사진</h2>
          <div className="adm-photo-grid">
            {(Array.isArray(job.media) ? job.media : []).map((item: any) => (
              <div className="adm-photo-item" key={item.id}>{item.type}<br />{item.file_path}</div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
