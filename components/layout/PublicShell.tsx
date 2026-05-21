"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { EVENT_TYPES } from "@/lib/event-types";
import { useTracking } from "@/lib/use-tracking";

type PublicShellProps = {
  children: React.ReactNode;
  kakaoUrl: string | null;
  maintenanceMode?: boolean;
};

export function PublicShell({ children, kakaoUrl, maintenanceMode = false }: PublicShellProps) {
  const pathname = usePathname();
  const { track } = useTracking();
  const isAdmin = pathname.startsWith("/admin");
  const isTechnician = pathname.startsWith("/technician");

  useEffect(() => {
    if (!isAdmin && !isTechnician) {
      void track(EVENT_TYPES.PAGE_VIEW, { page_path: pathname });
    }
  }, [isAdmin, isTechnician, pathname, track]);

  if (isAdmin || isTechnician) return <>{children}</>;

  return (
    <>
      <Header kakaoUrl={kakaoUrl} />
      {maintenanceMode && (
        <div className="maintenance-banner" role="status">
          현재 서비스 점검 중입니다. 예약과 상담 응답이 평소보다 늦어질 수 있어요.
        </div>
      )}
      {children}
      <Footer />
    </>
  );
}
