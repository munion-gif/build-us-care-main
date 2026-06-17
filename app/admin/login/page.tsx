"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const payload = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setMessage("비밀번호가 올바르지 않아요");
      return;
    }
    if (payload?.data?.localMode) {
      setMessage("로컬 확인 모드에서는 로그인 없이 관리자 화면을 확인할 수 있어요.");
    }
    window.location.href = "/admin";
  }

  return (
    <main className="admin-login-page">
      <form className="adm-card" onSubmit={submit}>
        <p className="adm-muted">Buildus Care Admin</p>
        <h1 className="adm-page-title">관리자 로그인</h1>
        <input className="adm-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호" autoComplete="current-password" autoFocus />
        {message && <span className="adm-badge adm-badge-red">{message}</span>}
        <button className="adm-btn adm-btn-primary" type="submit" disabled={loading}>
          로그인
        </button>
      </form>
    </main>
  );
}
