"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TechnicianShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/technician/login";
  const jobId = pathname.match(/^\/technician\/([^/]+)/)?.[1] ?? null;
  const isJobRoute = Boolean(jobId && jobId !== "login");
  const isPhotos = pathname.includes("/photos");
  const photosHref = isJobRoute ? `/technician/${jobId}/photos` : "/technician";

  return (
    <div className="tech-shell">
      {children}
      {!isLogin ? (
        <nav className="tech-bottom-tabs" aria-label="기사 앱 하단 메뉴">
          <Link className={!isPhotos ? "active" : ""} href={isJobRoute ? `/technician/${jobId}` : "/technician"}>
            일정
          </Link>
          <Link className={isPhotos ? "active" : ""} href={photosHref} aria-disabled={!isJobRoute}>
            현장사진
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
