import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const root = dirname(fileURLToPath(import.meta.url));

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["framer-api"],
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  turbopack: {
    root,
  },
  // Allow large request bodies for AI chat — user-attached images arrive as
  // base64 data URLs (~5-10MB) on the current message. History images are
  // stripped client-side and server-side so only the latest image is large.
  experimental: {
    proxyClientMaxBodySize: "25mb",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
