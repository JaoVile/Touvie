import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Browsers probe /favicon.ico unconditionally; point it at our SVG icon
  // so the request 200s instead of logging a 404 in the console.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/brand/touvie-icon.svg" }];
  },
};

export default withNextIntl(nextConfig);
