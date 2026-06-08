"use client";

import { type LucideIcon, Ruler, Salad, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

export type DietTab = "hoje" | "alimentos" | "medidas";

const TABS: Array<{ id: DietTab; label: string; icon: LucideIcon }> = [
  { id: "hoje", label: "Hoje", icon: UtensilsCrossed },
  { id: "alimentos", label: "Alimentos", icon: Salad },
  { id: "medidas", label: "Medidas", icon: Ruler },
];

/**
 * Editorial tab strip — line icon + uppercase tracked label, the active tab
 * marked by a gold gradient underline sitting on the shared hairline. Shares
 * the dashboard's card vocabulary so the page reads as one system.
 */
export function Tabs({ current }: { current: DietTab }) {
  return (
    <div
      className="mb-6 flex gap-1 overflow-x-auto border-b"
      style={{ borderColor: "var(--color-border)" }}
    >
      {TABS.map((t) => {
        const active = t.id === current;
        const Icon = t.icon;
        return (
          <Link
            key={t.id}
            href={`/dieta?t=${t.id}`}
            className="group relative flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-eyebrow font-semibold uppercase tracking-[0.1em] transition-colors"
            style={{ color: active ? "var(--color-accent)" : "var(--color-fg-subtle)" }}
          >
            <Icon size={14} strokeWidth={1.75} />
            {t.label}
            {active ? (
              <span
                className="absolute inset-x-0 -bottom-px h-0.5"
                style={{
                  background:
                    "linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 8%, transparent) 92%)",
                }}
              />
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
