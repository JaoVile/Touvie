import type { ReactNode } from "react";
import { DEFAULT_THEME, type ThemeId, isValidTheme } from "@/lib/themes";

interface ThemeProviderProps {
  theme: string | null | undefined;
  children: ReactNode;
}

/**
 * Applies `data-theme` on <html> via an inline <style>-less approach.
 * Runs on the server — no hydration flicker.
 */
export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const active: ThemeId = isValidTheme(theme) ? theme : DEFAULT_THEME;
  return (
    <>
      {/* Client boot script ensures <html data-theme="..."> is applied before first paint. */}
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: tiny static string, no user input interpolated in DOM
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.setAttribute('data-theme', ${JSON.stringify(active)});`,
        }}
      />
      {children}
    </>
  );
}
