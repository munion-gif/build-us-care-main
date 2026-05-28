import type { ReactNode } from "react";
import { getPublicAppConfig } from "@/lib/app-config";
import { PublicShell } from "@/components/layout/PublicShell";
import "./globals.css";

export const dynamic = "force-dynamic";

const siteTitle = "Build us Care";
const siteDescription = "집 안의 작은 교체, 먼저 확인하세요";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://builduscare.co.kr";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    siteName: siteTitle,
    url: siteUrl,
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: siteDescription,
        type: "image/png"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og-image.png"]
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg"
  },
  alternates: {
    canonical: siteUrl
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
