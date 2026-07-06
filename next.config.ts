import os from "node:os";
import type { NextConfig } from "next";

const quoteProductRedirects = [
  ["toilet_replace", "toilet"],
  ["basin_replace", "washbasin"],
  ["washbasin_replace", "washbasin"],
  ["faucet_replace", "faucet"],
  ["bidet_install", "bidet"],
  ["ventilator_replace", "ventilation"],
  ["sash_handle", "window-handle"],
  ["door_handle", "door-handle"],
  ["silicone_repair", "silicone"],
  ["bath_accessory", "bath-accessory"]
].map(([sourceCode, category]) => ({
  source: `/quote/${sourceCode}`,
  destination: `/products/${category}`,
  permanent: false
}));

const legacyPublicPageRedirects = [
  ["/services", "/"],
  ["/services/:path*", "/"],
  ["/orders/lookup", "/order-lookup"],
  ["/orders/lookup/:path*", "/order-lookup"],
  ["/quote/:path*", "/products"],
  ["/flow/:path*", "/"],
  ["/lab/:path*", "/"],
  ["/payment/success/:path*", "/order-lookup"],
  ["/payment/fail/:path*", "/order-lookup"]
].map(([source, destination]) => ({
  source,
  destination,
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
  devIndicators: false,
  allowedDevOrigins: Array.from(new Set(["127.0.0.1", ...localDevOrigins(), ...configuredDevOrigins()])),
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.builduscare.co.kr" }],
        destination: "https://builduscare.co.kr/:path*",
        permanent: true
      },
      {
        source: "/request/photo",
        destination: "/",
        permanent: false
      },
      {
        source: "/request/photo/:path*",
        destination: "/",
        permanent: false
      },
      ...quoteProductRedirects,
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
