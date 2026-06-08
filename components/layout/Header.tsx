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
      <img className="logo-image" src="/assets/bc-logo.png" alt="Build us Care" />
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
                <Link key={href} className={isActive(href) ? "active" : ""} href={href}>
                  {label}
                </Link>
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
    height: 54px;
    border-bottom: 1px solid rgba(120, 120, 140, 0.14);
    background: rgba(245, 245, 247, 0.82);
    backdrop-filter: blur(20px) saturate(1.7);
  }
  .header-inner {
    width: min(var(--content-wide), 100%);
    height: 100%;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 24px;
    margin-inline: auto;
    padding-inline: 24px;
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
    height: 26px;
    object-fit: contain;
  }
  .desktop-nav {
    display: flex;
    gap: 24px;
    align-items: center;
  }
  .desktop-nav a,
  .mobile-menu nav a {
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: 14px;
    line-height: 20px;
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
    gap: 8px;
  }
  .outline-cta,
  .filled-cta,
  .mobile-primary-cta {
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 8px 15px;
    font-size: 14px;
    line-height: 20px;
    font-weight: 700;
    letter-spacing: 0;
    text-decoration: none;
  }
  .outline-cta {
    border: 1px solid var(--color-border);
    color: var(--color-text);
    background: #ffffff;
  }
  .filled-cta {
    border: 1px solid var(--color-primary);
    background: var(--color-primary);
    color: #ffffff;
  }
  .filled-cta {
    gap: 8px;
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: #ffffff;
    box-shadow: none;
  }
  .kakao-mark {
    display: inline-grid;
    place-items: center;
    min-width: 34px;
    height: 18px;
    border-radius: var(--radius-full);
    background: #fee500;
    color: #101828;
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
    border: 1px solid var(--color-primary);
    border-radius: 999px;
    padding: 0 11px;
    background: var(--color-primary);
    color: #ffffff;
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
    inset: 54px 0 0;
    z-index: 60;
    background: rgba(16, 24, 40, 0.12);
  }
  .mobile-menu {
    max-height: calc(100vh - 54px);
    overflow-y: auto;
    padding: 6px 16px 10px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
    box-shadow: 0 14px 28px rgba(16, 24, 40, 0.08);
  }
  .mobile-menu nav {
    display: grid;
    gap: 0;
  }
  .mobile-menu nav a {
    min-height: 44px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--color-border);
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
      height: 28px;
    }
  }
  @media (max-width: 520px) {
    .mobile-kakao-cta {
      display: none;
    }
    .site-logo .logo-image {
      height: 26px;
    }
  }
`;
