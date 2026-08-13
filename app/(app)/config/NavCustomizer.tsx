"use client";

import { NAV_ITEMS, NAV_PRIMARY_SLOTS, resolvePrimary } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { updateNavPrimary } from "./actions";

/**
 * Escolhe quais módulos ficam na barra inferior do celular.
 *
 * "Mais" e "Config" não aparecem aqui de propósito: são fixos na barra. Sem o
 * "Mais" você perderia o acesso aos módulos não escolhidos, e sem o "Config"
 * perderia o acesso a esta própria tela.
 */
export function NavCustomizer({ current }: { current: string[] | null }) {
  const t = useTranslations("config.navBar");
  const tNav = useTranslations("nav");
  const [selected, setSelected] = useState<string[]>(() => resolvePrimary(current));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string>();

  const full = selected.length === NAV_PRIMARY_SLOTS;

  function toggle(href: string) {
    setSaved(false);
    setErr(undefined);
    setSelected((prev) =>
      prev.includes(href)
        ? prev.filter((h) => h !== href)
        : // Não deixa passar de 4 — o layout da barra é desenhado pra 4 + Mais + Config.
          prev.length < NAV_PRIMARY_SLOTS
          ? [...prev, href]
          : prev,
    );
  }

  function save() {
    startTransition(async () => {
      const res = await updateNavPrimary(selected);
      if (res?.error) {
        setErr(res.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div>
      <p className="mb-2 text-xs" style={{ color: "var(--color-fg-muted)" }}>
        {t("counter", { count: selected.length, total: NAV_PRIMARY_SLOTS })}
      </p>

      <ul className="mb-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const on = selected.includes(item.href);
          // Cheio e não-marcado: desmarque algo antes de trocar.
          const blocked = full && !on;
          return (
            <li key={item.href}>
              <button
                type="button"
                onClick={() => toggle(item.href)}
                disabled={blocked || pending}
                aria-pressed={on}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[11px] font-medium transition",
                  on ? "gradient-brand text-white" : "opacity-70 hover:opacity-100",
                  blocked && "cursor-not-allowed opacity-30 hover:opacity-30",
                )}
                style={{ borderColor: "var(--color-border)" }}
              >
                <item.Icon size={18} strokeWidth={1.75} aria-hidden />
                <span className="max-w-full truncate leading-tight">{tNav(item.labelKey)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!full || pending}
          className="rounded-lg border px-3 py-2 font-medium text-sm disabled:opacity-50"
          style={{ borderColor: "var(--color-border)", color: "var(--color-fg)" }}
        >
          {pending ? t("saving") : t("save")}
        </button>
        {saved && (
          <span className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
            {t("saved")}
          </span>
        )}
        {err && (
          <span className="text-xs" style={{ color: "var(--color-danger, #ef4444)" }}>
            {err}
          </span>
        )}
      </div>
    </div>
  );
}
