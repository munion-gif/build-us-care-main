"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TechnicianShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/technician/login";
  const isPhotos = pathname.includes("/photos");

  return (
    <div className="tech-shell">
      {children}
      {!isLogin ? (
        <nav className="tech-bottom-tabs" aria-label="기사 앱 하단 메뉴">
          <Link className={!isPhotos ? "active" : ""} href="/technician">
            일정
          </Link>
          <Link className={isPhotos ? "active" : ""} href="/technician">
            현장사진
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
