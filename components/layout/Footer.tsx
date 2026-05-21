import Link from "next/link";

const links = [
  ["서비스", "/services"],
  ["시공 사례", "/cases"],
  ["사진 판정", "/request/photo"],
  ["주문 현황 조회", "/orders/lookup"]
] as const;

const legalLinks = [
  ["개인정보처리방침", "/privacy"],
  ["취소·환불 안내", "/refund-policy"]
] as const;

export function Footer() {
  return (
    <footer className="global-footer">
      <style>{footerCss}</style>
      <div className="footer-inner">
        <div className="footer-brand">
          <Link href="/" className="footer-logo">
            <span>build us care</span>
          </Link>
          <div className="footer-meta" aria-label="회사 정보">
            <span>운영사: 주식회사 무니온(muniOn)</span>
            <span>대표: 김영태</span>
            <span>사업자등록번호: 601-81-39840</span>
            <span>주소: 경기도 용인시 수지구 포은대로59번길 37, B407호</span>
            <span>이메일: munion@mymunion.com</span>
          </div>
        </div>
        <nav aria-label="푸터 메뉴">
          {links.map(([label, href]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
          <span className="footer-legal-links" aria-label="약관 및 정책">
            {legalLinks.map(([label, href]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </span>
        </nav>
      </div>
      <div className="footer-bottom">© 2026 Buildus Care. All rights reserved.</div>
    </footer>
  );
}

const footerCss = `
  .global-footer {
    background: var(--color-text);
    color: rgba(247, 241, 230, 0.72);
  }
  .footer-inner,
  .footer-bottom {
    width: min(var(--content-wide), 100%);
    margin-inline: auto;
    padding-inline: var(--space-6);
  }
  .footer-inner {
    display: flex;
    justify-content: space-between;
    gap: var(--space-8);
    padding-block: var(--space-10, 2.5rem);
  }
  .footer-logo {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: #fff;
    text-decoration: none;
    font-size: var(--text-lg);
    font-weight: 500;
    letter-spacing: 0.14em;
  }
  .footer-meta {
    max-width: 720px;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.875rem;
    margin-top: var(--space-4);
    line-height: 1.65;
  }
  .footer-meta span {
    overflow-wrap: anywhere;
  }
  .global-footer nav {
    display: flex;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  .global-footer nav a {
    color: rgba(255, 255, 255, 0.72);
    text-decoration: none;
  }
  .footer-legal-links {
    display: inline-flex;
    gap: var(--space-3);
  }
  .footer-bottom {
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    padding-block: var(--space-4);
    font-size: var(--text-sm);
  }
  @media (max-width: 640px) {
    .footer-inner {
      display: grid;
      gap: var(--space-8);
      padding-inline: var(--space-4);
      padding-block: var(--space-12);
    }
    .footer-bottom {
      padding-inline: var(--space-4);
    }
    .footer-meta {
      display: grid;
      gap: 0.375rem;
      line-height: 1.75;
    }
    .global-footer nav {
      display: grid;
      gap: var(--space-4);
    }
    .footer-legal-links {
      display: flex;
      flex-wrap: wrap;
    }
  }
`;
