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

const navItems: ReadonlyArray<readonly [string, string]> = [
  ["서비스", "/service"],
  ["제품", "/products"],
  ["사진확인", "/photo-check"],
  ["주문조회", "/order-lookup"]
];

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
  const kakaoChatUrl = getKakaoChannelChatUrl(kakaoUrl) ?? "https://pf.kakao.com/_PxkzsX";
  const isPaymentHeader = pathname.startsWith("/payment/transfer");
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const hasMenuItems = navItems.length > 0 && !isPaymentHeader;
  const showDesktopKakao = isPaymentHeader;
  const headerClassName = `global-header${isPaymentHeader ? " header-payment" : ""}`;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className={headerClassName} style={{ paddingTop: isApp ? "var(--safe-area-top)" : undefined }}>
      <style>{headerCss}</style>
      <div className="header-inner">
        <Logo />
        {hasMenuItems ? (
          <nav className="desktop-nav" aria-label="주요 메뉴">
            {navItems.map(([label, href]) => (
              <Link key={href} className={isActive(href) ? "active" : ""} href={href}>
                {label}
              </Link>
            ))}
          </nav>
        ) : (
          <span aria-hidden="true" />
        )}
        <div className="desktop-actions">
          {showDesktopKakao ? (
            <a className="filled-cta" href={kakaoChatUrl} target="_blank" rel="noreferrer">
              <span className="kakao-mark" aria-hidden="true">TALK</span>
              카톡 상담
            </a>
          ) : null}
        </div>
        {hasMenuItems ? (
          <>
            <button className="mobile-menu-button" type="button" onClick={() => setOpen((current) => !current)} aria-label={open ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={open}>
              <Menu size={24} />
            </button>
          </>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      {open && hasMenuItems && (
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
    --header-content-max: 1120px;
    --header-content-pad: 40px;
    position: sticky;
    top: 0;
    z-index: 50;
    height: 38px;
    border-bottom: 1px solid rgba(120, 120, 140, 0.14);
    background: rgba(245, 245, 247, 0.82);
    backdrop-filter: blur(20px) saturate(1.7);
  }
  .header-inner {
    width: min(var(--header-content-max), 100%);
    height: 100%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0;
    margin-inline: auto;
    padding-inline: var(--header-content-pad);
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
    height: 22px;
    object-fit: contain;
  }
  .desktop-nav {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    gap: 24px;
    align-items: center;
  }
  .desktop-nav a,
  .mobile-menu nav a {
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: 13px;
    line-height: 18px;
    font-weight: 500;
    transition: color var(--transition);
  }
  .desktop-nav a:hover,
  .desktop-nav a.active,
  .mobile-menu nav a.active {
    color: var(--color-text);
    font-weight: 500;
  }
  .desktop-actions {
    display: inline-flex;
    margin-left: auto;
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
    gap: 8px;
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
    line-height: 1;
    font-weight: 700;
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
    border: 0;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text);
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
    .global-header {
      height: 54px;
    }
    .header-inner {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 12px;
      padding-inline: 16px;
    }
    .desktop-nav {
      display: none;
      position: static;
      transform: none;
    }
    .desktop-actions {
      display: none;
    }
    .mobile-menu-button {
      display: grid;
      justify-self: end;
    }
    .site-logo .logo-image {
      height: 28px;
    }
  }
  @media (max-width: 520px) {
    .site-logo .logo-image {
      height: 26px;
    }
  }
`;
