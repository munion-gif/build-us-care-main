"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useIsApp } from "@/hooks/useIsApp";
import { getKakaoChannelChatUrl } from "@/lib/kakao-channel";

type HeaderProps = {
  kakaoUrl: string | null;
};

const navItems = [
  ["서비스", "/services"],
  ["시공 사례", "/cases"],
  ["사진확인", "/request/photo"],
  ["주문 조회", "/orders/lookup"]
] as const;

function Logo() {
  return (
    <Link className="site-logo" href="/">
      <span className="wordmark">build us care</span>
    </Link>
  );
}

export function Header({ kakaoUrl }: HeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isApp = useIsApp();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const kakaoChatUrl = getKakaoChannelChatUrl(kakaoUrl);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="global-header" style={{ paddingTop: isApp ? "var(--safe-area-top)" : undefined }}>
      <style>{headerCss}</style>
      <div className="header-inner">
        <Logo />
        <nav className="desktop-nav" aria-label="주요 메뉴">
          {navItems.map(([label, href]) => (
            <Link key={href} className={isActive(href) ? "active" : ""} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="desktop-actions">
          <Link className="outline-cta" href="/request/photo">
            사진확인
          </Link>
          {kakaoUrl ? (
            <a className="filled-cta" href={kakaoUrl} target="_blank" rel="noreferrer">
              <span className="kakao-mark" aria-hidden="true">TALK</span>
              카톡 상담
            </a>
          ) : (
            <button className="filled-cta" type="button" disabled>
              <span className="kakao-mark" aria-hidden="true">TALK</span>
              카톡 상담
            </button>
          )}
        </div>
        {kakaoChatUrl ? (
          <a className="mobile-kakao-cta" href={kakaoChatUrl} target="_blank" rel="noreferrer">
            <span className="kakao-dot" aria-hidden="true" />
            상담
          </a>
        ) : (
          <button className="mobile-kakao-cta" type="button" disabled>
            <span className="kakao-dot" aria-hidden="true" />
            상담
          </button>
        )}
        <button className="mobile-menu-button" type="button" onClick={() => setOpen(true)} aria-label="메뉴 열기">
          <Menu size={24} />
        </button>
      </div>
      {open && (
        <div className="mobile-menu-backdrop" onMouseDown={() => setOpen(false)} role="presentation">
          <div className="mobile-menu" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="모바일 메뉴">
            <div className="mobile-menu-top">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} aria-label="메뉴 닫기">
                <X size={24} />
              </button>
            </div>
            <nav>
              {navItems.map(([label, href]) => (
                <Link key={href} className={isActive(href) ? "active" : ""} href={href}>
                  {label}
                </Link>
              ))}
            </nav>
            <Link className="mobile-primary-cta" href="/request/photo">
              사진확인
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

const headerCss = `
  .global-header {
    position: sticky;
    top: 0;
    z-index: 50;
    height: 60px;
    border-bottom: 1px solid var(--color-border);
    background: rgba(247, 241, 230, 0.92);
    backdrop-filter: blur(12px);
  }
  .header-inner {
    width: min(var(--content-wide), 100%);
    height: 100%;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--space-6);
    margin-inline: auto;
    padding-inline: var(--space-6);
  }
  .site-logo {
    display: inline-flex;
    align-items: center;
    color: var(--color-text);
    text-decoration: none;
  }
  .site-logo .wordmark {
    color: var(--color-text);
    font-family: var(--font-brand);
    font-size: 17px;
    font-weight: var(--brand-logo-weight);
    letter-spacing: var(--brand-logo-letter-spacing);
    line-height: 1;
  }
  .desktop-nav {
    display: flex;
    gap: var(--space-8);
    align-items: center;
  }
  .desktop-nav a,
  .mobile-menu nav a {
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: var(--text-sm);
    font-weight: 500;
    transition: color var(--transition);
  }
  .desktop-nav a:hover,
  .desktop-nav a.active,
  .mobile-menu nav a.active {
    color: var(--color-primary);
    font-weight: 650;
  }
  .desktop-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .outline-cta,
  .filled-cta,
  .mobile-primary-cta {
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    padding: var(--space-2) 1.25rem;
    font-size: var(--text-sm);
    font-weight: 650;
    text-decoration: none;
  }
  .outline-cta {
    border: 1px solid var(--color-border);
    color: var(--color-primary);
    background: rgba(255, 250, 241, 0.54);
  }
  .filled-cta {
    border: 1px solid var(--color-primary);
    background: var(--color-primary);
    color: var(--color-cream);
  }
  .filled-cta {
    gap: 8px;
    border-color: rgba(34, 33, 29, 0.92);
    background: rgba(34, 33, 29, 0.92);
    color: var(--color-cream);
    box-shadow: none;
  }
  .kakao-mark {
    display: inline-grid;
    place-items: center;
    min-width: 34px;
    height: 18px;
    border-radius: var(--radius-full);
    background: #fee500;
    color: #22211d;
    font-size: 9px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: 0;
  }
  .filled-cta:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .mobile-menu-button {
    width: 44px;
    height: 44px;
    display: none;
    place-items: center;
    justify-self: end;
    border: 0;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text);
  }
  .mobile-kakao-cta {
    min-height: 40px;
    display: none;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid rgba(34, 33, 29, 0.92);
    border-radius: 8px;
    padding: 0 var(--space-4);
    background: rgba(34, 33, 29, 0.92);
    color: var(--color-cream);
    text-decoration: none;
    font-size: var(--text-sm);
    font-weight: 650;
    white-space: nowrap;
  }
  .kakao-dot {
    width: 9px;
    height: 9px;
    border-radius: var(--radius-full);
    background: #fee500;
  }
  .mobile-kakao-cta:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .mobile-menu-backdrop {
    position: fixed;
    inset: 60px 0 0;
    z-index: 60;
    background: rgba(26, 25, 22, 0.22);
  }
  .mobile-menu {
    display: grid;
    gap: var(--space-8);
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-border);
    background: rgba(247, 241, 230, 0.98);
    box-shadow: var(--shadow-md);
  }
  .mobile-menu-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .mobile-menu-top button {
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: var(--radius-full);
    background: var(--color-surface-2);
  }
  .mobile-menu nav {
    display: grid;
    gap: var(--space-4);
  }
  .mobile-menu nav a {
    font-size: var(--text-xl);
    font-weight: 650;
  }
  @media (max-width: 820px) {
    .header-inner {
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: var(--space-2);
      padding-inline: var(--space-3);
    }
    .desktop-nav,
    .desktop-actions {
      display: none;
    }
    .mobile-menu-button {
      display: grid;
    }
    .mobile-kakao-cta {
      display: inline-flex;
    }
    .site-logo .wordmark {
      font-size: 15px;
      letter-spacing: 0.12em;
    }
  }
`;
