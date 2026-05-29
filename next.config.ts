import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Browsers probe /favicon.ico unconditionally; point it at our SVG icon
  // so the request 200s instead of logging a 404 in the console.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icons/icon.svg" }];
  },
};

export default withNextIntl(nextConfig);
