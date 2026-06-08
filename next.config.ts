import os from "node:os";
import type { NextConfig } from "next";

const legacyPublicPageRedirects = [
  "/services/:path*",
  "/cases/:path*",
  "/request/photo/:path*",
  "/orders/lookup/:path*",
  "/quote/:path*",
  "/flow/:path*",
  "/lab/:path*",
  "/payment/success/:path*",
  "/payment/fail/:path*"
].map((source) => ({
  source,
  destination: "/",
  permanent: false
}));

function localDevOrigins() {
  return Object.values(os.networkInterfaces())
    .flatMap((items) => items ?? [])
    .filter((item) => item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
}

function configuredDevOrigins() {
  return (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const nextConfig: NextConfig = {
  typedRoutes: false,
  allowedDevOrigins: Array.from(new Set(["127.0.0.1", ...localDevOrigins(), ...configuredDevOrigins()])),
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.builduscare.co.kr" }],
        destination: "https://builduscare.co.kr/:path*",
        permanent: true
      },
      ...legacyPublicPageRedirects
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
        ]
      }
    ];
  }
};

export default nextConfig;
