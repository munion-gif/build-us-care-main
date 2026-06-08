import type { ReactNode } from "react";
import { getPublicAppConfig } from "@/lib/app-config";
import { PublicShell } from "@/components/layout/PublicShell";
import "./globals.css";

const siteTitle = "Build us Care";
const siteDescription = "집 안의 작은 교체, 먼저 확인하세요";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://builduscare.co.kr";

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
        url: "/og-buildus-care-v2.png",
        width: 1600,
        height: 768,
        alt: "집 전체가 아니라, 바꿀 수 있는 것부터.",
        type: "image/png"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og-buildus-care-v2.png"]
  },
  verification: {
    other: {
      "naver-site-verification": "f510836c862f58b14245fbcc6f2c01c9ee6a9a14"
    }
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
        <meta name="theme-color" content="#f5f5f7" />
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
(() => {
  const ATTR = "bis_skin_checked";
  const clean = (root = document) => {
    if (root instanceof Element && root.hasAttribute(ATTR)) root.removeAttribute(ATTR);
    root.querySelectorAll?.("[" + ATTR + "]").forEach((node) => node.removeAttribute(ATTR));
  };
  clean();
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName === ATTR && mutation.target instanceof Element) {
        mutation.target.removeAttribute(ATTR);
      }
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) clean(node);
      });
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: [ATTR] });
})();
            `.trim()
          }}
        />
      </body>
    </html>
  );
}
