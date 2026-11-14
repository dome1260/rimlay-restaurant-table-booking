import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  // TODO(Phase 4): remove once the customer booking page lives at "/".
  async redirects() {
    return [{ source: "/", destination: "/backoffice", permanent: false }];
  },
};

export default nextConfig;
