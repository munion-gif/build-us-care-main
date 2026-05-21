"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatKRDateTime, formatOrderStatus } from "@/lib/format";

type TechJob = {
  id: string;
  status: string;
  scheduled_at: string | null;
  service_name: string;
  order_number: string | null;
  address_summary: string | null;
};

export function TechnicianJobsClient() {
  const [name, setName] = useState("기사님");
  const [jobs, setJobs] = useState<TechJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/technician/jobs");
      const payload = await response.json();
      if (response.status === 401) {
        window.location.href = "/technician/login";
        return;
      }
      setName(payload.data?.technician?.name ?? "기사님");
      setJobs(payload.data?.jobs ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <main className="tech-container">
      <header className="tech-header">
        <div>
          <span className="tech-kicker">{new Intl.DateTimeFormat("ko-KR", { dateStyle: "full" }).format(new Date())}</span>
          <h1 className="tech-title">{name} 일정</h1>
          <p className="tech-sub">오늘과 앞으로 예정된 현장만 보여드립니다.</p>
        </div>
      </header>

      {loading ? (
        <section className="tech-empty">일정을 불러오고 있어요.</section>
      ) : jobs.length === 0 ? (
        <section className="tech-empty">오늘 배정된 일정이 없습니다.</section>
      ) : (
        <section className="tech-stack">
          {jobs.map((job) => (
            <Link className="tech-card tech-stack" href={`/technician/${job.id}`} key={job.id}>
              <div className="tech-row">
                <strong>{job.service_name}</strong>
                <span className="tech-badge">{formatOrderStatus(job.status)}</span>
              </div>
              <span className="tech-muted">{job.scheduled_at ? formatKRDateTime(job.scheduled_at) : "일정 확인 중"}</span>
              <span className="tech-muted">{job.address_summary ?? "주소 확인 중"}</span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
