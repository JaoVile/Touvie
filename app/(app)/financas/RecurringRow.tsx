"use client";

import { formatBRL } from "@/lib/utils";
import { Bell, Repeat } from "lucide-react";
import { useTransition } from "react";
import { deleteTransaction } from "./actions";

interface Props {
  tx: {
    id: string;
    amount_cents: number;
    kind: "income" | "expense";
    description: string | null;
    reminder_enabled: boolean;
    day: number | null;
    label: string;
    category: { name: string; emoji: string | null; color: string | null } | null;
    account: { name: string } | null;
  };
}

export function RecurringRow({ tx }: Props) {
  const [pending, start] = useTransition();

  function remove() {
    if (!confirm("Apagar esta recorrência?")) return;
    start(async () => {
      await deleteTransaction(tx.id);
    });
  }

  const sign = tx.kind === "income" ? "+" : "−";
  const color = tx.kind === "income" ? "var(--color-success)" : "var(--color-danger)";

  return (
    <li
      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm"
      style={{ background: "var(--color-card)" }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
          style={{ background: tx.category?.color ?? "var(--color-bg-elevated)" }}
        >
          {tx.category?.emoji ?? <Repeat size={15} style={{ color: "var(--color-fg-muted)" }} />}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1 truncate font-medium">
            {tx.description || tx.category?.name || "(sem descrição)"}
            {tx.reminder_enabled ? (
              <Bell size={11} className="shrink-0" style={{ color: "var(--color-fg-subtle)" }} />
            ) : null}
          </div>
          <div className="truncate text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
            {tx.label}
            {tx.account ? ` · ${tx.account.name}` : ""}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm" style={{ color }}>
          {sign} {formatBRL(tx.amount_cents)}
        </span>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="rounded px-1.5 py-1 text-xs hover:opacity-80 disabled:opacity-40"
          style={{ color: "var(--color-fg-subtle)" }}
          aria-label="Apagar recorrência"
        >
          ×
        </button>
      </div>
    </li>
  );
}
