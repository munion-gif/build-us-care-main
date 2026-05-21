import type { ReactNode } from "react";
import { getPublicAppConfig } from "@/lib/app-config";
import { PublicShell } from "@/components/layout/PublicShell";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Buildus Care — 교체·수리, 지금 바로 예약",
  description: "정찰가로 투명하게, 검증 기사가 직접 시공합니다. 변기·수전·전등·콘센트 교체 즉시 예약.",
  openGraph: {
    title: "Buildus Care",
    description: "교체·수리 정찰가 예약 서비스",
    siteName: "Buildus Care",
    images: ["/icon.svg"]
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg"
  },
  alternates: {
    canonical: "https://builduscare.co.kr"
  }
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const appConfig = await getPublicAppConfig();

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..850&family=Quicksand:wght@300..700&display=swap" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css" />
      </head>
      <body suppressHydrationWarning>
        <PublicShell kakaoUrl={appConfig.kakaoChannelUrl} maintenanceMode={appConfig.maintenanceMode}>
          {children}
        </PublicShell>
      </body>
    </html>
  );
}
