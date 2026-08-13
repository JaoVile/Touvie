"use client";

import { NAV_CONFIG, NAV_ITEMS, resolvePrimary } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import { Ellipsis, type LucideIcon } from "lucide-react";
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
/**
 * `primary` são os hrefs escolhidos pra barra de baixo (`profiles.nav_primary`,
 * passado pelo layout). Ausente ou corrompido cai no padrão — barra quebrada
 * seria pior que barra não-personalizada.
 */
export function Nav({ primary }: { primary?: string[] | null }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const chosen = resolvePrimary(primary);
  const label = (item: (typeof NAV_ITEMS)[number]): NavItem => ({
    href: item.href,
    label: t(item.labelKey),
    Icon: item.Icon,
  });

  // Ordem da barra segue a ordem da escolha; o que sobrar vai pro "Mais" na
  // ordem canônica dos módulos — assim nenhum módulo some da navegação.
  const PRIMARY: NavItem[] = chosen
    .map((href) => NAV_ITEMS.find((i) => i.href === href))
    .filter((i): i is (typeof NAV_ITEMS)[number] => Boolean(i))
    .map(label);
  const SECONDARY: NavItem[] = NAV_ITEMS.filter((i) => !chosen.includes(i.href)).map(label);
  const CONFIG: NavItem = label(NAV_CONFIG);
  // O desktop mostra tudo na ordem canônica, independente da escolha do celular.
  const ALL: NavItem[] = [...NAV_ITEMS.map(label), CONFIG];

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
