import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const root = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["framer-api"],
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    root,
  },
  // Allow large request bodies for AI chat — user-attached images arrive as
  // base64 data URLs (~5-10MB) on the current message. History images are
  // stripped client-side and server-side so only the latest image is large.
  experimental: {
    proxyClientMaxBodySize: "25mb",
  },
};

export default nextConfig;
