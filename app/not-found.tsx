import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <style>{css}</style>
      <section className="not-found-card">
        <span className="brand-kicker">build us care</span>
        <div className="not-found-label" aria-hidden="true">
          <span>page status</span>
          <strong>not found</strong>
          <small>check the link first</small>
        </div>
        <h1>페이지를 찾을 수 없어요</h1>
        <p>주소가 바뀌었거나 더 이상 사용하지 않는 페이지입니다. 홈 화면에서 다시 시작해 주세요.</p>
        <div className="not-found-actions">
          <Link href="/">홈으로 가기</Link>
        </div>
      </section>
    </main>
  );
}

const css = `
  .not-found-page {
    min-height: 70vh;
    display: grid;
    place-items: center;
    padding: var(--space-6) var(--space-4);
    background:
      linear-gradient(90deg, rgba(16, 24, 40, 0.035) 1px, transparent 1px),
      linear-gradient(180deg, rgba(16, 24, 40, 0.035) 1px, transparent 1px),
      var(--color-bg);
    background-size: 34px 34px;
  }
  .not-found-card {
    width: min(640px, 100%);
    display: grid;
    gap: var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: clamp(22px, 4vw, 34px);
    background: #ffffff;
    box-shadow: 0 14px 34px rgba(16, 24, 40, 0.055);
  }
  .not-found-page .brand-kicker {
    color: var(--color-text);
    font-family: var(--font-brand);
    font-size: 13px;
    font-weight: var(--brand-label-weight);
    letter-spacing: var(--brand-letter-spacing);
    text-transform: lowercase;
  }
  .not-found-label {
    display: grid;
    gap: 6px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 18px;
    background: #ffffff;
  }
  .not-found-label span,
  .not-found-label small {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: lowercase;
  }
  .not-found-label strong {
    font-family: var(--font-brand);
    font-size: var(--text-hero);
    line-height: var(--leading-hero);
    font-weight: 700;
    letter-spacing: 0;
  }
  .not-found-page h1 {
    margin: 0;
    font-size: var(--text-h2);
    line-height: var(--leading-h2);
    font-weight: 700;
    letter-spacing: 0;
  }
  .not-found-page p {
    max-width: 34rem;
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.65;
  }
  .not-found-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .not-found-page a {
    min-height: 46px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-full);
    padding: 0 var(--space-5);
    text-decoration: none;
    font-size: var(--text-sm);
    font-weight: 700;
  }
  .not-found-page a:first-child {
    border: 1px solid var(--color-gold);
    background: var(--color-gold);
    color: #211c12;
  }
`;
