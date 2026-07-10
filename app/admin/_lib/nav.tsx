"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminFetch, getCache, setCache } from "./ui";

const ICONS: Record<string, React.ReactNode> = {
  home: (
    <svg className="ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3.5 9.5 10 3.5l6.5 6M5 8.8V16h10V8.8" />
    </svg>
  ),
  orders: (
    <svg className="ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 5h12M4 10h12M4 15h8" />
    </svg>
  ),
  inquiries: (
    <svg className="ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="5" width="14" height="11" rx="2" />
      <circle cx="10" cy="10.5" r="3" />
    </svg>
  ),
  calendar: (
    <svg className="ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="14" height="13" rx="2" />
      <path d="M3 8h14M7 2.5V5M13 2.5V5" />
    </svg>
  ),
  settings: (
    <svg className="ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 3v2.2M10 14.8V17M3 10h2.2M14.8 10H17M5 5l1.6 1.6M13.4 13.4L15 15M15 5l-1.6 1.6M6.6 13.4L5 15" />
    </svg>
  )
};

type MenuItem = { href: string; icon: string; label: string; badge?: "orders" | "inquiries" };

const MENU: MenuItem[] = [
  { href: "/admin", icon: "home", label: "홈" },
  { href: "/admin/orders", icon: "orders", label: "예약 주문", badge: "orders" },
  { href: "/admin/inquiries", icon: "inquiries", label: "사진확인 문의", badge: "inquiries" },
  { href: "/admin/calendar", icon: "calendar", label: "예약 캘린더" },
  { href: "/admin/settings", icon: "settings", label: "설정" }
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [badges, setBadges] = useState<{ orders: number; inquiries: number }>({ orders: 0, inquiries: 0 });

  useEffect(() => {
    let alive = true;
    async function load() {
      const res = await adminFetch<{ count?: number; cancelRequestedCount?: number; pendingDiagnosisCount?: number }>(
        "/api/admin/orders/unassigned-count",
        { cache: "no-store" }
      );
      if (!alive) return;
      setBadges({
        orders: Number(res.data?.count ?? 0) + Number(res.data?.cancelRequestedCount ?? 0),
        inquiries: Number(res.data?.pendingDiagnosisCount ?? 0)
      });
    }
    load();
    const interval = window.setInterval(load, 30000);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
    };
  }, [pathname]);

  // 첫 진입 시 주요 데이터 미리 받아두기 → 첫 메뉴 클릭이 즉시 뜸
  useEffect(() => {
    if (getCache("orders")) return;
    (async () => {
      const [o, s] = await Promise.all([
        adminFetch<{ orders: any[] }>("/api/admin/orders?limit=100"),
        adminFetch("/api/admin/stats")
      ]);
      if (o.ok && o.data && !getCache("orders")) {
        setCache("orders", (o.data.orders ?? []).filter((x: any) => !x.deleted_at && !x.is_test));
      }
      if (s.ok && s.data && !getCache("stats")) setCache("stats", s.data);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await adminFetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="side" aria-label="관리자 메뉴">
      <div className="logo">
        <div className="word">
          BUILD US <em>CARE</em>
        </div>
        <div className="sub">관리자</div>
      </div>
      <div className="nav">
        {MENU.map((m) => {
          const count = m.badge ? badges[m.badge] : 0;
          return (
            <Link key={m.href} href={m.href} className={isActive(m.href) ? "on" : ""}>
              {ICONS[m.icon]}
              <span className="tx">{m.label}</span>
              {count > 0 ? <span className="cnt">{count}</span> : null}
            </Link>
          );
        })}
      </div>
      <div className="foot">
        <span className="who">Build us Care</span> · 관리자
        <br />
        builduscare.co.kr · <button onClick={logout}>로그아웃</button>
      </div>
    </nav>
  );
}
