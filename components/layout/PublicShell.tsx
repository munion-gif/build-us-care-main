"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { NavigationFeedback } from "@/components/layout/NavigationFeedback";
import { BuilduscareStyleLinks } from "@/components/builduscare/customer-page-css";
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
  const isPaymentTransfer = pathname.startsWith("/payment/transfer");
  const usesBuilduscareCustomerStyles =
    pathname === "/" ||
    pathname.startsWith("/service") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/photo-check") ||
    pathname.startsWith("/reservation") ||
    pathname.startsWith("/order-lookup") ||
    pathname.startsWith("/order-status") ||
    pathname.startsWith("/as-request") ||
    pathname.startsWith("/quote-preview");

  useEffect(() => {
    if (!isAdmin && !isTechnician) {
      void track(EVENT_TYPES.PAGE_VIEW, { page_path: pathname });
    }
  }, [isAdmin, isTechnician, pathname, track]);

  if (isAdmin || isTechnician) return <>{children}</>;

  return (
    <>
      {usesBuilduscareCustomerStyles && <BuilduscareStyleLinks />}
      <Header kakaoUrl={kakaoUrl} />
      <NavigationFeedback />
      {maintenanceMode && (
        <div className="maintenance-banner" role="status">
          현재 서비스 점검 중입니다. 예약과 상담 응답이 평소보다 늦어질 수 있어요.
        </div>
      )}
      {children}
      {!isPaymentTransfer && <Footer />}
    </>
  );
}
