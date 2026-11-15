import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E runs its own dev server next to the everyday one, which would otherwise hold the .next lock.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
