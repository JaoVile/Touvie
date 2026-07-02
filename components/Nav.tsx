"use client";

import { cn } from "@/lib/utils";
import {
  Bell,
  BookOpen,
  CalendarDays,
  Dumbbell,
  Ellipsis,
  Hourglass,
  House,
  Lock,
  type LucideIcon,
  Salad,
  Search,
  Settings,
  StickyNote,
  Target,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string; Icon: LucideIcon };

/**
 * Navegação do app. Duas formas:
 *  - Desktop (sm+): barra superior sticky com TODOS os módulos (cabe na tela larga).
 *  - Mobile (<sm): barra inferior ENXUTA — só os principais (Hoje, Finanças,
 *    Treino, Dieta) + "Mais" (abre os secundários num painel) + Opções. Evita o
 *    amontoado de 11 ícones espremidos no rodapé do celular.
 */
export function Nav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const PRIMARY: NavItem[] = [
    { href: "/", label: t("today"), Icon: House },
    { href: "/financas", label: t("finances"), Icon: Wallet },
    { href: "/treino", label: t("training"), Icon: Dumbbell },
    { href: "/dieta", label: t("diet"), Icon: Salad },
  ];
  const SECONDARY: NavItem[] = [
    { href: "/rotina", label: t("routine"), Icon: CalendarDays },
    { href: "/metas", label: t("goals"), Icon: Target },
    { href: "/diario", label: t("diary"), Icon: Lock },
    { href: "/capsulas", label: t("capsules"), Icon: Hourglass },
    { href: "/notas", label: t("notes"), Icon: StickyNote },
    { href: "/leitura", label: t("reading"), Icon: BookOpen },
    { href: "/busca", label: t("search"), Icon: Search },
    { href: "/notificacoes", label: t("notifications"), Icon: Bell },
  ];
  const CONFIG: NavItem = { href: "/config", label: t("config"), Icon: Settings };
  const ALL: NavItem[] = [...PRIMARY, ...SECONDARY, CONFIG];

  const itemCls = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-all duration-200 ease-out",
      "sm:flex-row sm:gap-1.5 sm:px-2 sm:py-2 sm:text-[11px]",
      "hover:-translate-y-0.5",
      active ? "gradient-brand text-white shadow" : "opacity-60 hover:opacity-100",
    );

  const barStyle = {
    background: "var(--color-bg)",
    borderColor: "var(--color-border)",
    color: "var(--color-fg)",
  };
  const moreActive = SECONDARY.some((l) => isActive(l.href));

  return (
    <>
      {/* ── Desktop (sm+): barra superior com TODOS os módulos ── */}
      <nav className="sticky top-0 z-40 hidden border-b backdrop-blur-xl sm:block" style={barStyle}>
        <ul className="flex w-full items-stretch gap-0.5 px-1 py-1">
          {ALL.map((link) => (
            <li key={link.href} className="flex flex-1">
              <Link href={link.href} className={itemCls(isActive(link.href))}>
                <link.Icon size={17} strokeWidth={1.75} className="shrink-0" />
                <span className="max-w-full truncate text-center leading-tight">{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Mobile (<sm): backdrop que fecha o painel "Mais" ao tocar fora ── */}
      {moreOpen ? (
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => setMoreOpen(false)}
          className="fixed inset-0 z-30 cursor-default sm:hidden"
          style={{ background: "color-mix(in srgb, var(--color-bg) 55%, transparent)" }}
        />
      ) : null}

      {/* ── Mobile (<sm): barra inferior enxuta ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl sm:hidden"
        style={{ ...barStyle, paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Painel "Mais" — secundários, acima da barra */}
        {moreOpen ? (
          <div
            className="absolute inset-x-0 bottom-full border-t p-2"
            style={{ background: "var(--color-bg)", borderColor: "var(--color-border)" }}
          >
            <ul className="grid grid-cols-3 gap-1.5">
              {SECONDARY.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 text-[11px] font-medium transition",
                      isActive(link.href)
                        ? "gradient-brand text-white"
                        : "opacity-70 hover:opacity-100",
                    )}
                  >
                    <link.Icon size={19} strokeWidth={1.75} />
                    <span className="leading-tight">{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <ul className="flex w-full items-stretch gap-0.5 px-1 py-1">
          {PRIMARY.map((link) => (
            <li key={link.href} className="flex flex-1">
              <Link
                href={link.href}
                onClick={() => setMoreOpen(false)}
                className={itemCls(isActive(link.href))}
              >
                <link.Icon size={17} strokeWidth={1.75} className="shrink-0" />
                <span className="max-w-full truncate text-center leading-tight">{link.label}</span>
              </Link>
            </li>
          ))}
          {/* Mais — abre os secundários */}
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className={itemCls(moreActive || moreOpen)}
            >
              <Ellipsis size={17} strokeWidth={1.75} className="shrink-0" />
              <span className="max-w-full truncate text-center leading-tight">{t("more")}</span>
            </button>
          </li>
          {/* Opções */}
          <li className="flex flex-1">
            <Link
              href={CONFIG.href}
              onClick={() => setMoreOpen(false)}
              className={itemCls(isActive(CONFIG.href))}
            >
              <CONFIG.Icon size={17} strokeWidth={1.75} className="shrink-0" />
              <span className="max-w-full truncate text-center leading-tight">{CONFIG.label}</span>
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}
