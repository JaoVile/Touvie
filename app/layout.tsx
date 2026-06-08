import { CustomColorsBoot } from "@/components/CustomColorsBoot";
import { NativePickerOpener } from "@/components/NativePickerOpener";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ThemeProvider } from "@/components/ThemeProvider";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_THEME } from "@/lib/themes";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

/**
 * Switzer — the body/UI sans. Self-hosted from Fontshare (free), it is the
 * actual body face of our design guide, obsidianassembly.com.
 */
const switzer = localFont({
  src: [
    { path: "./fonts/Switzer-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Switzer-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-switzer",
  display: "swap",
});

/**
 * Pinyon Script — formal copperplate, used as a personal-mark signature
 * face. Self-hosted via @fontsource so it always loads, even when
 * Google Fonts is unreachable (corporate proxy, cert revocation, etc).
 */
const pinyonScript = localFont({
  src: [{ path: "./fonts/PinyonScript-Regular.woff2", weight: "400", style: "normal" }],
  variable: "--font-pinyon",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Touvie",
  description: "Tudo da sua vida — rotina, metas, finanças, treino, diário e mais.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Touvie",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#08112e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

async function loadUserTheme(): Promise<string> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return DEFAULT_THEME;
    const { data } = await supabase
      .from("profiles")
      .select("theme")
      .eq("id", user.id)
      .maybeSingle();
    let theme = data?.theme;
    // One-time migration to the new visual identity (Royal Navy + Gold):
    // any profile still pinned to the prior default (glass-purple) gets
    // promoted to royal and the write is persisted. Picking glass-purple
    // again from /config will trip this branch on next load — that's the
    // intended trade-off until/unless we re-enable glass-purple as a
    // first-class option.
    if (theme === "glass-purple") {
      await supabase.from("profiles").update({ theme: "royal" }).eq("id", user.id);
      theme = "royal";
    }
    // The light "notion-clean" preset was retired (its slot became the
    // "Personalizar" theme). Anyone still pinned to it falls back to royal.
    if (theme === "notion-clean") {
      await supabase.from("profiles").update({ theme: "royal" }).eq("id", user.id);
      theme = "royal";
    }
    return theme ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [theme, locale, messages] = await Promise.all([
    loadUserTheme(),
    getLocale(),
    getMessages(),
  ]);

  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${switzer.variable} ${pinyonScript.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* Instrument Serif (display) + JetBrains Mono (figuras) via <link> —
            antes vinham de next/font/google, mas o processo Node deste
            ambiente não alcança o Google Fonts e derrubava o dev a cada
            recompilação. O navegador baixa normal. (Self-host = TODO.) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap"
        />
        <CustomColorsBoot />
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider theme={theme}>{children}</ThemeProvider>
        </NextIntlClientProvider>
        <ServiceWorkerRegister />
        <NativePickerOpener />
      </body>
    </html>
  );
}
