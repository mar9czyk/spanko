import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Dodatkowe hosty dev (LAN, Tailscale), np. ALLOWED_DEV_ORIGINS=192.168.0.161,100.106.23.28,pc.tail1234.ts.net
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins,
  // Dev: telefon nie dosięgnie 127.0.0.1 laptopa, więc PocketBase wystawiamy pod /pb tego samego originu.
  // Bez kompresji, żeby nie buforować strumienia SSE (realtime). Na produkcji /pb obsługuje Caddy.
  ...(isDev && {
    compress: false,
    async rewrites() {
      const target = process.env.POCKETBASE_INTERNAL_URL || "http://127.0.0.1:8090";
      return [{ source: "/pb/:path*", destination: `${target}/:path*` }];
    },
  }),
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
