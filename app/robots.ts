import type { MetadataRoute } from "next";

// AI 학습·스크래핑용 크롤러 (콘텐츠 복제 목적) — 전체 차단
const AI_SCRAPER_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "PerplexityBot",
  "Bytespider",
  "Amazonbot",
  "Applebot-Extended",
  "cohere-ai",
  "Diffbot",
  "ImagesiftBot",
  "Omgilibot",
  "FacebookBot",
  "meta-externalagent"
];

// 검색엔진 등에도 노출하지 않을 사적/거래 경로
const PRIVATE_PATHS = [
  "/api/",
  "/admin/",
  "/technician/",
  "/reservation/",
  "/order-lookup",
  "/order-status"
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://builduscare.co.kr";
  return {
    rules: [
      // 일반/검색엔진 봇: 홍보를 위해 공개 페이지는 허용, 사적 경로만 차단
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS
      },
      // AI 스크래퍼/복제 봇: 전체 차단
      {
        userAgent: AI_SCRAPER_BOTS,
        disallow: "/"
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`
  };
}
