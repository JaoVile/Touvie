"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";

export type DietTab = "hoje" | "alimentos" | "medidas";

const TABS: Array<{ id: DietTab; label: string; emoji: string }> = [
  { id: "hoje", label: "Hoje", emoji: "🍽️" },
  { id: "alimentos", label: "Alimentos", emoji: "🥗" },
  { id: "medidas", label: "Medidas", emoji: "📐" },
];

export function Tabs({ current }: { current: DietTab }) {
  return (
    <div
      className="mb-4 flex gap-1 overflow-x-auto rounded-lg p-1"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      {TABS.map((t) => {
        const active = t.id === current;
        return (
          <Link
            key={t.id}
            href={`/dieta?t=${t.id}`}
            className={cn(
              "flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-center text-sm font-medium transition",
              active ? "text-white shadow" : "hover:opacity-80",
            )}
            style={{
              background: active ? "var(--gradient-brand)" : "transparent",
              color: active ? "white" : "var(--color-fg-muted)",
            }}
          >
            <span className="mr-1">{t.emoji}</span>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
