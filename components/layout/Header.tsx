"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
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
      <img className="logo-image" src="/builduscare-logo.png" alt="Build us Care" />
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
            <a key={href} className={isActive(href) ? "active" : ""} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="desktop-actions">
          <a className="outline-cta" href="/request/photo">
            사진확인
          </a>
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
          <a className="mobile-kakao-cta" href={kakaoChatUrl} target="_blank" rel="noreferrer" aria-label="카카오톡 상담 열기">
            <span className="kakao-mark" aria-hidden="true">TALK</span>
            카톡
          </a>
        ) : (
          <button className="mobile-kakao-cta" type="button" disabled aria-label="카카오톡 상담 준비 중">
            <span className="kakao-mark" aria-hidden="true">TALK</span>
            카톡
          </button>
        )}
        <button className="mobile-menu-button" type="button" onClick={() => setOpen((current) => !current)} aria-label={open ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={open}>
          <Menu size={24} />
        </button>
      </div>
      {open && (
        <div className="mobile-menu-backdrop" onMouseDown={() => setOpen(false)} role="presentation">
          <div className="mobile-menu" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="모바일 메뉴">
            <nav>
              {navItems.map(([label, href]) => (
                <a key={href} className={isActive(href) ? "active" : ""} href={href}>
                  {label}
                </a>
              ))}
            </nav>
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
  }
  .site-logo {
    display: inline-flex;
    align-items: center;
    color: var(--color-text);
    text-decoration: none;
  }
  .site-logo .logo-image {
    display: block;
    width: auto;
    height: 40px;
    object-fit: contain;
    mix-blend-mode: multiply;
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
    font-size: var(--text-label);
    line-height: var(--leading-label);
    font-weight: 600;
    transition: color var(--transition);
  }
  .desktop-nav a:hover,
  .desktop-nav a.active,
  .mobile-menu nav a.active {
    color: var(--color-primary);
    font-weight: 700;
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
    font-size: var(--text-button);
    line-height: var(--leading-button);
    font-weight: 700;
    letter-spacing: -0.005em;
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
    font-size: var(--text-caption);
    font-weight: 700;
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
    gap: 6px;
    border: 1px solid rgba(34, 33, 29, 0.92);
    border-radius: 8px;
    padding: 0 11px;
    background: rgba(34, 33, 29, 0.92);
    color: var(--color-cream);
    text-decoration: none;
    font-size: var(--text-label);
    line-height: var(--leading-button);
    font-weight: 700;
    white-space: nowrap;
  }
  .mobile-kakao-cta .kakao-mark {
    min-width: 32px;
    height: 18px;
    font-size: 10px;
  }
  .mobile-kakao-cta:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .mobile-menu-backdrop {
    position: fixed;
    inset: 60px 0 0;
    z-index: 60;
    background: rgba(26, 25, 22, 0.12);
  }
  .mobile-menu {
    max-height: calc(100vh - 60px);
    overflow-y: auto;
    padding: 6px 16px 10px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
    box-shadow: 0 14px 28px rgba(34, 33, 29, 0.08);
  }
  .mobile-menu nav {
    display: grid;
    gap: 0;
  }
  .mobile-menu nav a {
    min-height: 44px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid rgba(217, 210, 196, 0.72);
    color: var(--color-text);
    font-size: var(--text-body-sm);
    line-height: var(--leading-body-sm);
    font-weight: 600;
  }
  .mobile-menu nav a:last-child {
    border-bottom: 0;
  }
  .mobile-menu nav a.active {
    color: var(--color-primary);
    font-weight: 700;
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
    .site-logo .logo-image {
      height: 34px;
    }
  }
`;
