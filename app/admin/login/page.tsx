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
    await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setMessage("비밀번호가 올바르지 않아요");
      return;
    }
    window.location.href = "/admin";
  }

  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="logo">
          <div className="word">
            BUILD US <em>CARE</em>
          </div>
        </div>
        <h1>관리자 로그인</h1>
        <p className="sub">관리자 비밀번호를 입력해주세요.</p>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="비밀번호"
          autoComplete="current-password"
          autoFocus
        />
        {message && <p className="login-err">{message}</p>}
        <button className="cta" type="submit" disabled={loading}>
          {loading ? "확인 중…" : "로그인"}
        </button>
      </form>
    </main>
  );
}
