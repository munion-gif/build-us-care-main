"use client";

import { useState } from "react";

export function TechnicianCheckinClient({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/technician/jobs/${jobId}/start`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    setLoading(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.message ?? "시공 시작 처리에 실패했어요.");
      return;
    }
    window.location.href = `/technician/${jobId}`;
  }

  return (
    <main className="tech-container">
      <header className="tech-header">
        <div>
          <span className="tech-kicker">Check-in</span>
          <h1 className="tech-title">지금 시공을 시작합니다</h1>
          <p className="tech-sub">버튼을 누르면 시작 시간이 자동 기록됩니다.</p>
        </div>
      </header>
      <section className="tech-card tech-stack">
        {error ? <p className="tech-sub">{error}</p> : null}
        <button className="tech-button" type="button" onClick={start} disabled={loading}>
          {loading ? "기록 중" : "시공 시작 확인"}
        </button>
      </section>
    </main>
  );
}
