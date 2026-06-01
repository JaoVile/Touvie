"use client";

import { cn } from "@/lib/utils";
import {
  BarChart3,
  CalendarDays,
  Download,
  type LucideIcon,
  PiggyBank,
  Receipt,
  Repeat,
  Wrench,
} from "lucide-react";
import Link from "next/link";

export type FinanceTab =
  | "lancamentos"
  | "recorrentes"
  | "contas"
  | "caixinhas"
  | "graficos"
  | "setup"
  | "importar";

const TABS: Array<{ id: FinanceTab; label: string; icon: LucideIcon }> = [
  { id: "lancamentos", label: "Lançamentos", icon: Receipt },
  { id: "recorrentes", label: "Recorrentes", icon: Repeat },
  { id: "contas", label: "Contas", icon: CalendarDays },
  { id: "caixinhas", label: "Caixinhas", icon: PiggyBank },
  { id: "graficos", label: "Gráficos", icon: BarChart3 },
  { id: "importar", label: "Importar", icon: Download },
  { id: "setup", label: "Setup", icon: Wrench },
];

export function Tabs({ current }: { current: FinanceTab }) {
  return (
    <div
      className="mb-4 flex gap-1 overflow-x-auto rounded-lg p-1"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      {TABS.map((t) => {
        const active = t.id === current;
        const Icon = t.icon;
        return (
          <Link
            key={t.id}
            href={`/financas?t=${t.id}`}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-center text-sm font-medium transition",
              active ? "text-white shadow" : "hover:opacity-80",
            )}
            style={{
              background: active ? "var(--gradient-brand)" : "transparent",
              color: active ? "white" : "var(--color-fg-muted)",
            }}
          >
            <Icon size={14} className="shrink-0" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
