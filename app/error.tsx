"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="app-error-page">
      <style>{css}</style>
      <section className="error-card" aria-labelledby="error-title">
        <span className="error-kicker">build us care</span>
        <h1 id="error-title">페이지를 다시 불러오지 못했습니다</h1>
        <p>
          새로고침 중 일시적인 문제가 발생했습니다. 다시 시도하거나 홈으로 이동해 제품 호환 확인을
          이어가주세요.
        </p>
        <div className="error-actions">
          <button className="retry-button" type="button" onClick={reset}>
            다시 시도
          </button>
          <Link className="home-link" href="/">홈으로 돌아가기</Link>
        </div>
      </section>
    </main>
  );
}

const css = `
  .app-error-page {
    min-height: 72vh;
    display: grid;
    place-items: center;
    padding: clamp(1rem, 4vw, 2.5rem);
    background:
      linear-gradient(90deg, rgba(217, 210, 196, 0.4) 0 1px, transparent 1px 100%),
      var(--color-bg);
    background-size: 64px 100%;
    color: var(--color-text);
  }
  .error-card {
    width: min(560px, 100%);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: rgba(255, 250, 241, 0.92);
    padding: clamp(1.5rem, 4vw, 2.5rem);
    text-align: center;
    box-shadow: 0 18px 46px rgba(34, 33, 29, 0.08);
  }
  .error-kicker {
    display: block;
    margin-bottom: 1rem;
    color: rgba(34, 33, 29, 0.58);
    font-family: var(--font-brand);
    font-size: 0.78rem;
    font-weight: var(--brand-label-weight);
    letter-spacing: 0.28em;
    text-transform: lowercase;
  }
  .error-card h1 {
    margin: 0;
    font-size: clamp(1.65rem, 4vw, 2.15rem);
    line-height: 1.18;
    word-break: keep-all;
  }
  .error-card p {
    max-width: 28rem;
    margin: 1rem auto 1.5rem;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: 1.7;
    word-break: keep-all;
  }
  .error-actions {
    display: flex;
    justify-content: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .error-actions a,
  .error-actions button {
    min-height: 52px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: var(--radius-full);
    padding: 0 var(--space-6);
    text-decoration: none;
    font-weight: 900;
    cursor: pointer;
  }
  .home-link {
    background: var(--color-primary);
    color: var(--color-surface);
  }
  .retry-button {
    background: var(--color-surface-2);
    color: var(--color-text);
  }
  @media (max-width: 520px) {
    .app-error-page {
      align-items: start;
      padding-top: 18vh;
    }
    .error-actions {
      display: grid;
    }
    .error-actions a,
    .error-actions button {
      width: 100%;
    }
  }
`;
