"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatKRDateTime, formatOrderStatus } from "@/lib/format";

type JobDetail = {
  id: string;
  status: string;
  scheduled_at: string | null;
  service_name: string;
  home: { address_full: string | null };
  customer: { name: string | null; phone: string | null };
};

export function TechnicianJobDetailClient({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("현장 정보를 불러오고 있어요.");

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setMessage("현장 정보를 불러오고 있어요.");
      try {
        const response = await fetch(`/api/technician/jobs/${jobId}`);
        const payload = await response.json();
        if (response.status === 401) {
          window.location.href = "/technician/login";
          return;
        }
        if (!alive) return;
        setJob(payload.data?.job ?? null);
        setMessage(response.ok ? "" : "현장을 찾을 수 없어요.");
      } catch {
        if (!alive) return;
        setJob(null);
        setMessage("현장 정보를 불러오지 못했어요. 다시 시도해주세요.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [jobId]);

  if (loading) {
    return <main className="tech-container"><section className="tech-empty">{message}</section></main>;
  }

  if (!job) {
    return <main className="tech-container"><section className="tech-empty">{message || "현장을 찾을 수 없어요."}</section></main>;
  }

  return (
    <main className="tech-container">
      <header className="tech-header">
        <div>
          <span className="tech-kicker">{formatOrderStatus(job.status)}</span>
          <h1 className="tech-title">{job.service_name}</h1>
          <p className="tech-sub">{job.scheduled_at ? formatKRDateTime(job.scheduled_at) : "일정 확인 중"}</p>
        </div>
      </header>

      <section className="tech-card tech-stack">
        <div>
          <strong>방문 주소</strong>
          <p className="tech-sub">{job.home.address_full ?? "주소 확인 중"}</p>
        </div>
        <div>
          <strong>고객 연락처</strong>
          <p className="tech-sub">{job.customer.name ?? "고객"} · {job.customer.phone ?? "전화번호 확인 중"}</p>
        </div>
      </section>

      <section className="tech-stack" style={{ marginTop: "var(--space-4)" }}>
        {job.status === "scheduled" ? (
          <Link className="tech-button" href={`/technician/${job.id}/checkin`}>시공 시작</Link>
        ) : job.status === "in_progress" ? (
          <>
            <Link className="tech-button secondary" href={`/technician/${job.id}/photos`}>사진 올리기</Link>
            <Link className="tech-button" href={`/technician/${job.id}/complete`}>완료 보고</Link>
          </>
        ) : (
          <section className="tech-empty">완료된 현장입니다.</section>
        )}
      </section>
    </main>
  );
}
