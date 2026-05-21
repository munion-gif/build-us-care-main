"use client";

import { FormEvent, useState } from "react";

export default function TechnicianLoginPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/technician/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    setLoading(false);
    if (!response.ok) {
      setError("기사 토큰이 올바르지 않아요.");
      return;
    }
    window.location.href = "/technician";
  }

  return (
    <main className="tech-container">
      <section className="tech-header">
        <div>
          <span className="tech-kicker">Buildus Care Technician</span>
          <h1 className="tech-title">기사 로그인</h1>
          <p className="tech-sub">받은 링크 또는 토큰으로 현장 일정을 확인합니다.</p>
        </div>
      </section>
      <form className="tech-card tech-stack" onSubmit={submit}>
        <label className="tech-label">
          기사 토큰
          <input className="tech-input" value={token} onChange={(event) => setToken(event.target.value)} placeholder="토큰을 입력해주세요" />
        </label>
        {error ? <p className="tech-sub">{error}</p> : null}
        <button className="tech-button" type="submit" disabled={loading || token.length < 8}>
          {loading ? "확인 중" : "로그인"}
        </button>
      </form>
    </main>
  );
}
