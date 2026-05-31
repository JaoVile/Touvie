"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";

export type FinanceTab =
  | "lancamentos"
  | "recorrentes"
  | "contas"
  | "caixinhas"
  | "graficos"
  | "setup"
  | "importar";

const TABS: Array<{ id: FinanceTab; label: string; emoji: string }> = [
  { id: "lancamentos", label: "Lançamentos", emoji: "🧾" },
  { id: "recorrentes", label: "Recorrentes", emoji: "🔁" },
  { id: "contas", label: "Contas", emoji: "📅" },
  { id: "caixinhas", label: "Caixinhas", emoji: "🪙" },
  { id: "graficos", label: "Gráficos", emoji: "📊" },
  { id: "importar", label: "Importar", emoji: "📥" },
  { id: "setup", label: "Setup", emoji: "🧰" },
];

export function Tabs({ current }: { current: FinanceTab }) {
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
            href={`/financas?t=${t.id}`}
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
