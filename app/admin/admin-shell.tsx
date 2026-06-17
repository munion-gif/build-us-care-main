"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Camera,
  ClipboardList,
  FileText,
  ListChecks,
} from "lucide-react";

const menus = [
  [Camera, "사진확인 접수", "/admin/diagnoses"],
  [ClipboardList, "제품 주문", "/admin/orders"],
  [FileText, "견적서", "/admin/quotes"],
  [ListChecks, "견적서 목록", "/admin/quotes/list"],
  [CalendarDays, "일정관리", "/admin/slots"]
] as const;

function isMenuActive(pathname: string, href: string) {
  if (href === "/admin/quotes") return pathname === href || pathname.startsWith("/admin/quotes/new");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [cancelRequestedCount, setCancelRequestedCount] = useState(0);
  const [pendingDiagnosisCount, setPendingDiagnosisCount] = useState(0);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    let active = true;
    async function loadCount() {
      try {
        const response = await fetch("/api/admin/orders/unassigned-count", { cache: "no-store" });
        const json = await response.json();
        if (active && response.ok) {
          setUnassignedCount(Number(json.data?.count ?? 0));
          setCancelRequestedCount(Number(json.data?.cancelRequestedCount ?? 0));
          setPendingDiagnosisCount(Number(json.data?.pendingDiagnosisCount ?? 0));
        }
      } catch {
        if (active) {
          setUnassignedCount(0);
          setCancelRequestedCount(0);
          setPendingDiagnosisCount(0);
        }
      }
    }
    loadCount();
    const interval = window.setInterval(loadCount, 30000);
    window.addEventListener("focus", loadCount);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", loadCount);
    };
  }, [pathname]);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <div className="adm-shell">
      <aside className="adm-sidebar">
        <Link className="adm-sidebar-logo" href="/admin/diagnoses">
          buildus care
        </Link>
        <nav className="adm-sidebar-nav">
          {menus.map(([Icon, label, href]) => (
            <Link key={href} className={`adm-sidebar-link ${isMenuActive(pathname, href) ? "active" : ""}`} href={href}>
              <Icon aria-hidden="true" size={17} strokeWidth={2.2} />
              {label}
              {href === "/admin/orders" && unassignedCount > 0 && <b className="adm-nav-badge">{unassignedCount}</b>}
              {href === "/admin/orders" && cancelRequestedCount > 0 && <b className="adm-nav-badge adm-nav-badge-warn">{cancelRequestedCount}</b>}
              {href === "/admin/diagnoses" && pendingDiagnosisCount > 0 && <b className="adm-nav-badge">{pendingDiagnosisCount}</b>}
            </Link>
          ))}
        </nav>
        <div className="adm-sidebar-footer">
          <button className="adm-btn adm-btn-secondary adm-btn-sm adm-logout" type="button" onClick={logout}>
            로그아웃
          </button>
        </div>
      </aside>
      <div className="adm-main">
        <header className="adm-mobile-top">
          <nav className="adm-mobile-nav">
            {menus.map(([, label, href]) => (
              <Link key={href} className={isMenuActive(pathname, href) ? "active" : ""} href={href}>
                {label}
                {href === "/admin/orders" && unassignedCount > 0 && <b className="adm-nav-badge">{unassignedCount}</b>}
                {href === "/admin/orders" && cancelRequestedCount > 0 && <b className="adm-nav-badge adm-nav-badge-warn">{cancelRequestedCount}</b>}
                {href === "/admin/diagnoses" && pendingDiagnosisCount > 0 && <b className="adm-nav-badge">{pendingDiagnosisCount}</b>}
              </Link>
            ))}
          </nav>
          <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={logout}>
            로그아웃
          </button>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
