import type { NextConfig } from "next";

// cacheComponents is intentionally off: every page in Prospecta is per-user and
// auth-gated, so request-time rendering is the right default.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  // Fonts read at runtime by the generated share images (opengraph-image).
  outputFileTracingIncludes: {
    "/**": ["./assets/fonts/**/*", "./node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"],
  },
};

export default nextConfig;
