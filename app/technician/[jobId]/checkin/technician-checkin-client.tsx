"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function TechnicianCheckinClient({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [localMode, setLocalMode] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const response = await fetch(`/api/technician/jobs/${jobId}`);
        const payload = await response.json();
        const code = String(payload?.error?.code ?? "");
        if (!alive) return;
        if (Boolean(payload?.data?.localMode) || code === "SUPABASE_NOT_CONFIGURED") {
          setLocalMode(true);
          setError("로컬 확인 모드에서는 시공 시작을 저장할 수 없습니다.");
        }
      } catch {
        // ignore probe failures here; the action button itself remains the main control
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [jobId]);

  async function start() {
    if (localMode) return;
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
        {localMode ? (
          <section className="tech-empty">
            <div className="tech-stack" style={{ width: "100%" }}>
              <strong>로컬 확인 모드입니다.</strong>
              <p className="tech-sub">{error || "시공 시작 기록은 실제 기사 배정 데이터가 연결된 뒤 사용할 수 있습니다."}</p>
              <Link className="tech-button secondary" href="/technician">목록으로 돌아가기</Link>
            </div>
          </section>
        ) : (
          <>
            {error ? <p className="tech-sub">{error}</p> : null}
            <button className="tech-button" type="button" onClick={start} disabled={loading || localMode}>
              {loading ? "기록 중" : localMode ? "로컬에서 시작 불가" : "시공 시작 확인"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
