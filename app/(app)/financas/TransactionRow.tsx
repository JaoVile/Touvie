"use client";

import { formatBRL } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useTransition } from "react";
import { deleteTransaction } from "./actions";

export interface LedgerItem {
  id: string;
  amount_cents: number;
  kind: "income" | "expense";
  description: string | null;
  category: { name: string; emoji: string | null; color: string | null } | null;
}

export function TransactionRow({ item }: { item: LedgerItem }) {
  const [pending, start] = useTransition();

  function remove() {
    if (!confirm("Apagar este lançamento?")) return;
    start(async () => {
      await deleteTransaction(item.id);
    });
  }

  const sign = item.kind === "income" ? "+" : "−";
  const color = item.kind === "income" ? "var(--color-success)" : "var(--color-danger)";
  const avatarBg = item.category?.color ?? "var(--color-bg-elevated)";
  const avatarContent = item.category?.emoji ? (
    item.category.emoji
  ) : item.kind === "income" ? (
    <TrendingUp size={15} style={{ color: "var(--color-success)" }} />
  ) : (
    <TrendingDown size={15} style={{ color: "var(--color-danger)" }} />
  );

  const title = item.description || item.category?.name || "(sem descrição)";
  const subtitle = item.category?.name ?? "Sem categoria";

  return (
    <li
      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm"
      style={{ background: "var(--color-card)" }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
          style={{ background: avatarBg }}
        >
          {avatarContent}
        </span>
        <div className="min-w-0">
          <div className="truncate font-medium">{title}</div>
          <div className="truncate text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
            {subtitle}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm" style={{ color }}>
          {sign} {formatBRL(item.amount_cents)}
        </span>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="rounded px-1.5 py-1 text-xs hover:opacity-80 disabled:opacity-40"
          style={{ color: "var(--color-fg-subtle)" }}
          aria-label="Apagar lançamento"
        >
          ×
        </button>
      </div>
    </li>
  );
}
