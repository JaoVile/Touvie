"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function Nav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const LINKS = [
    { href: "/", label: t("today"), emoji: "🏠" },
    { href: "/rotina", label: t("routine"), emoji: "📅" },
    { href: "/metas", label: t("goals"), emoji: "🎯" },
    { href: "/diario", label: t("diary"), emoji: "🔒" },
    { href: "/financas", label: t("finances"), emoji: "💰" },
    { href: "/treino", label: t("training"), emoji: "💪" },
    { href: "/dieta", label: t("diet"), emoji: "🥗" },
    { href: "/notas", label: t("notes"), emoji: "📝" },
    { href: "/busca", label: t("search"), emoji: "🔍" },
    { href: "/notificacoes", label: t("notifications"), emoji: "🔔" },
  ] as const;

  const configActive = pathname.startsWith("/config");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl sm:sticky sm:top-0 sm:border-b sm:border-t-0"
      style={{
        background: "var(--color-bg)",
        borderColor: "var(--color-border)",
        color: "var(--color-fg)",
      }}
    >
      <div className="mx-auto flex max-w-5xl items-center sm:px-4" style={{ paddingBottom: "calc(0 + env(safe-area-inset-bottom))" }}>
        <ul className="flex flex-1 items-center gap-1 overflow-x-auto px-2 py-2 sm:gap-3 sm:px-0" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <li key={link.href} className="flex-1 sm:flex-initial">
                <Link
                  href={link.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition sm:flex-row sm:gap-2 sm:text-sm",
                    active ? "gradient-brand text-white shadow-lg" : "hover:opacity-80",
                  )}
                >
                  <span className="text-base sm:text-sm">{link.emoji}</span>
                  <span>{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Config sempre visível, fora do scroll */}
        <div className="shrink-0 border-l px-2 py-2 sm:px-3" style={{ borderColor: "var(--color-border)", paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
          <Link
            href="/config"
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition sm:flex-row sm:gap-2 sm:text-sm",
              configActive ? "gradient-brand text-white shadow-lg" : "hover:opacity-80",
            )}
          >
            <span className="text-base sm:text-sm">⚙️</span>
            <span>{t("config")}</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
