import Link from "next/link";

export function Footer() {
  return (
    <footer className="global-footer">
      <style>{footerCss}</style>
      <div className="footer-inner">
        <section className="footer-column footer-brand" aria-label="회사 정보">
          <Link href="/" className="footer-logo">
            <img className="footer-logo-image" src="/assets/bc-logo.png" alt="Build us Care" />
          </Link>
          <dl className="footer-meta">
            <div>
              <dt>운영사</dt>
              <dd>주식회사 무니온(muniOn)</dd>
            </div>
            <div>
              <dt>대표</dt>
              <dd>김영태</dd>
            </div>
            <div>
              <dt>사업자등록번호</dt>
              <dd>601-81-39840</dd>
            </div>
            <div>
              <dt>주소</dt>
              <dd>경기도 용인시 수지구 포은대로59번길 37, B407호</dd>
            </div>
            <div>
              <dt>이메일</dt>
              <dd>munion@mymunion.com</dd>
            </div>
          </dl>
        </section>
      </div>
      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <span>© 2026 Buildus Care. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}

const footerCss = `
  .global-footer {
    border-top: 1px solid var(--color-border);
    background: #f5f5f7;
    color: var(--color-text-muted);
  }
  .footer-inner,
  .footer-bottom-inner {
    width: min(var(--content-wide), 100%);
    margin-inline: auto;
    padding-inline: var(--space-6);
  }
  .footer-inner {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: flex-start;
    gap: clamp(2rem, 7vw, 7rem);
    padding-block: 2.5rem 1.75rem;
  }
  .footer-column {
    min-width: 0;
  }
  .footer-heading {
    margin: 0 0 0.75rem;
    color: var(--color-text);
    font-size: var(--text-label);
    line-height: var(--leading-label);
    font-weight: 700;
  }
  .footer-logo {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }
  .footer-logo-image {
    display: block;
    width: min(168px, 58vw);
    height: auto;
  }
  .footer-meta {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.375rem 1.25rem;
    margin-top: var(--space-3);
    font-size: var(--text-caption);
    line-height: var(--leading-caption);
  }
  .footer-meta div {
    display: contents;
  }
  .footer-meta dt {
    color: var(--color-text-faint);
    font-weight: 600;
  }
  .footer-meta dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .footer-link-grid {
    display: grid;
    gap: 0.625rem;
  }
  .footer-links a,
  .footer-policy-links a {
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: var(--text-label);
    line-height: var(--leading-label);
    font-weight: 600;
  }
  .footer-links a:hover,
  .footer-policy-links a:hover {
    color: var(--color-text);
  }
  .footer-bottom {
    border-top: 1px solid var(--color-border);
  }
  .footer-bottom-inner {
    min-height: 50px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space-4);
    font-size: var(--text-caption);
    line-height: var(--leading-caption);
  }
  .footer-policy-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.875rem;
  }
  @media (max-width: 640px) {
    .footer-inner {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.625rem;
      padding-inline: var(--space-4);
      padding-block: 1.75rem;
    }
    .footer-logo-image {
      width: min(190px, 68vw);
    }
    .footer-bottom-inner {
      min-height: 0;
      display: grid;
      gap: 0.75rem;
      padding-inline: var(--space-4);
      padding-block: 0.875rem;
    }
    .footer-meta {
      gap: 0.25rem 0.875rem;
    }
    .footer-link-grid {
      grid-template-columns: 1fr;
    }
  }
`;
