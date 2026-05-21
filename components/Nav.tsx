"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export function Nav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const LINKS = [
    { href: "/",             label: t("today"),         emoji: "🏠" },
    { href: "/rotina",       label: t("routine"),       emoji: "📅" },
    { href: "/metas",        label: t("goals"),         emoji: "🎯" },
    { href: "/diario",       label: t("diary"),         emoji: "🔒" },
    { href: "/financas",     label: t("finances"),      emoji: "💰" },
    { href: "/treino",       label: t("training"),      emoji: "💪" },
    { href: "/dieta",        label: t("diet"),          emoji: "🥗" },
    { href: "/notas",        label: t("notes"),         emoji: "📝" },
    { href: "/busca",        label: t("search"),        emoji: "🔍" },
    { href: "/notificacoes", label: t("notifications"), emoji: "🔔" },
    { href: "/config",       label: t("config"),        emoji: "⚙️" },
  ] as const;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl sm:sticky sm:top-0 sm:border-b sm:border-t-0"
      style={{
        background: "var(--color-bg)",
        borderColor: "var(--color-border)",
        color: "var(--color-fg)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ul className="flex w-full items-stretch gap-0.5 px-1 py-1">
        {LINKS.map((link) => {
          const active =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <li key={link.href} className="flex flex-1">
              <Link
                href={link.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-all duration-200 ease-out",
                  "sm:flex-row sm:gap-1.5 sm:px-2 sm:py-2 sm:text-[11px]",
                  "hover:-translate-y-0.5",
                  active
                    ? "gradient-brand text-white shadow"
                    : "opacity-60 hover:opacity-100",
                )}
              >
                <span className="text-base leading-none sm:text-sm">{link.emoji}</span>
                <span className="truncate max-w-full text-center leading-tight">{link.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
