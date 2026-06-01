"use client";

import { cn } from "@/lib/utils";
import { FolderKanban, History, type LucideIcon, Target, Trophy } from "lucide-react";
import Link from "next/link";

export type WorkoutTab = "hoje" | "programas" | "historico" | "prs";

const TABS: Array<{ id: WorkoutTab; label: string; icon: LucideIcon }> = [
  { id: "hoje", label: "Hoje", icon: Target },
  { id: "programas", label: "Programas", icon: FolderKanban },
  { id: "historico", label: "Histórico", icon: History },
  { id: "prs", label: "PRs", icon: Trophy },
];

export function Tabs({ current }: { current: WorkoutTab }) {
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
            href={`/treino?t=${t.id}`}
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
