import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security/headers";

const securityHeaders = buildSecurityHeaders({
  isDevelopment: process.env.NODE_ENV === "development",
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
});

function serverActionOrigins(): string[] {
  const origins = new Set<string>();
  for (const value of [process.env.NEXT_PUBLIC_APP_URL, process.env.TRUSTED_ORIGINS]) {
    for (const entry of (value ?? "").split(",")) {
      try {
        const host = new URL(entry.trim()).host;
        if (host) origins.add(host);
      } catch {
        // Ignore malformed optional configuration.
      }
    }
  }
  return [...origins];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [40, 55, 75, 90],
    minimumCacheTTL: 86_400,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "motion"],
    serverActions: {
      bodySizeLimit: "3mb",
      allowedOrigins: serverActionOrigins(),
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      { source: "/wes/:path*", destination: "/pcm/:path*", permanent: true },
      { source: "/:locale(en|fr|pcm)/overview", destination: "/:locale", permanent: true },
      { source: "/:locale(en|fr|pcm)/product", destination: "/:locale/features", permanent: true },
      { source: "/:locale(en|fr|pcm)/channels", destination: "/:locale/services", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Vary", value: "Origin, Cookie" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

export default nextConfig;
