import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["pt-BR", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pt-BR";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value ?? defaultLocale;
  const locale = (locales as readonly string[]).includes(raw) ? (raw as Locale) : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
