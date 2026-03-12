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
};

export default nextConfig;
