"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardList, Home, Menu, MessageCircle, Search, UserRound } from "lucide-react";
import { useState } from "react";

type MobileAppBarProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  showBack?: boolean;
  showChat?: boolean;
  showSearch?: boolean;
};

type MobileBottomNavProps = {
  active?: "home" | "lookup" | "chat" | "account";
};

const primaryMenuLinks = [
  ["서비스 소개", "/service"],
  ["사진으로 확인하기", "/photo-check"],
  ["바꿀 수 있는 제품 보기", "/products"]
] as const;

const supportMenuLinks = [
  ["내 주문 · 진행현황", "/order-lookup"],
  ["A/S 접수", "/as-request"]
] as const;

export function MobileAppBar({ title, subtitle, backHref = "/", showBack = true, showChat = false, showSearch = false }: MobileAppBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bc-mobile-only mobile-app-chrome">
      <div className={`mobile-appbar${showBack ? "" : " no-back"}`}>
        {showBack && (
          <Link className="mobile-icon-btn" href={backHref} aria-label="뒤로가기">
            <ChevronLeft aria-hidden="true" />
          </Link>
        )}
        <strong>{title}{subtitle && <> <small>{subtitle}</small></>}</strong>
        <div className="mobile-appbar-actions">
          {showSearch && (
            <button className="mobile-icon-btn" type="button" aria-label="검색">
              <Search aria-hidden="true" />
            </button>
          )}
          {showChat && (
            <a className="mobile-icon-btn" href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer" aria-label="카카오톡 상담">
              <MessageCircle aria-hidden="true" />
            </a>
          )}
          <button className="mobile-icon-btn" type="button" aria-label="메뉴 열기" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            <Menu aria-hidden="true" />
          </button>
        </div>
      </div>
      {open && (
        <nav className="mobile-app-menu" aria-label="모바일 메뉴">
          {primaryMenuLinks.map(([label, href]) => (
            <Link key={href} className="mobile-menu-link" href={href} onClick={() => setOpen(false)}>
              <span>{label}</span>
              <ChevronRight aria-hidden="true" />
            </Link>
          ))}
          {supportMenuLinks.map(([label, href]) => (
            <Link key={href} className="mobile-menu-link" href={href} onClick={() => setOpen(false)}>
              <span>{label}</span>
              <ChevronRight aria-hidden="true" />
            </Link>
          ))}
          <a className="mobile-menu-kakao" href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            <MessageCircle aria-hidden="true" />
            카카오톡 상담
          </a>
        </nav>
      )}
    </div>
  );
}

export function MobileBottomNav({ active }: MobileBottomNavProps) {
  return (
    <nav className="bc-mobile-only mobile-bottom-nav" aria-label="하단 메뉴">
      <Link className={active === "home" ? "on" : ""} href="/">
        <Home aria-hidden="true" />
        <span>홈</span>
      </Link>
      <Link className={active === "lookup" ? "on" : ""} href="/order-lookup">
        <ClipboardList aria-hidden="true" />
        <span>주문조회</span>
      </Link>
      <a className={active === "chat" ? "on" : ""} href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer">
        <MessageCircle aria-hidden="true" />
        <span>상담</span>
      </a>
      <Link className={active === "account" ? "on" : ""} href="/order-lookup">
        <UserRound aria-hidden="true" />
        <span>내정보</span>
      </Link>
    </nav>
  );
}
