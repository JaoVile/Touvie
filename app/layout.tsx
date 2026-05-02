import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DEFAULT_THEME } from "@/lib/themes";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

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
    apple: "/icons/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#a855f7",
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
    const { data } = await supabase.from("profiles").select("theme").eq("id", user.id).maybeSingle();
    return data?.theme ?? DEFAULT_THEME;
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
    <html lang={locale} data-theme={theme} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider theme={theme}>{children}</ThemeProvider>
        </NextIntlClientProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
