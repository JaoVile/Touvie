"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { updateLocale } from "./actions";

const LOCALES = [
  { value: "pt-BR", flag: "🇧🇷" },
  { value: "en", flag: "🇺🇸" },
] as const;

export function LocaleSwitcher({ currentLocale }: { currentLocale: string }) {
  const t = useTranslations("config.language");
  const [pending, start] = useTransition();

  function handleChange(locale: string) {
    start(async () => {
      await updateLocale(locale);
      window.location.reload();
    });
  }

  return (
    <div className="flex gap-2">
      {LOCALES.map(({ value, flag }) => {
        const active = currentLocale === value;
        const label = value === "pt-BR" ? t("ptBR") : t("en");
        return (
          <button
            key={value}
            type="button"
            disabled={pending || active}
            onClick={() => handleChange(value)}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition hover:opacity-80 disabled:cursor-default"
            style={{
              borderColor: active ? "var(--color-accent)" : "var(--color-border)",
              background: active ? "var(--color-accent)" : "transparent",
              color: active ? "white" : "var(--color-fg)",
              opacity: pending && !active ? 0.5 : 1,
            }}
          >
            <span>{flag}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
