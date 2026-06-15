import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Browsers probe /favicon.ico unconditionally; point it at our SVG icon
  // so the request 200s instead of logging a 404 in the console.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/brand/touvie-icon.svg" }];
  },
  // A landing morou em /conceito até 2026-06-11 — preserva links antigos.
  async redirects() {
    return [
      { source: "/conceito", destination: "/landpage", permanent: false },
      { source: "/conceito/:path*", destination: "/landpage/:path*", permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
