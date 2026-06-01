"use client";

import { formatBRL } from "@/lib/utils";
import { Repeat, TrendingDown, TrendingUp } from "lucide-react";
import { useTransition } from "react";
import { deleteTransaction, deleteTransfer } from "./actions";

export type LedgerItem =
  | {
      type: "tx";
      id: string;
      amount_cents: number;
      kind: "income" | "expense";
      description: string | null;
      category: { name: string; emoji: string | null; color: string | null } | null;
      account: { name: string } | null;
      installment: { number: number; total: number } | null;
    }
  | {
      type: "transfer";
      id: string;
      amount_cents: number;
      description: string | null;
      from: string | null;
      to: string | null;
    };

export function TransactionRow({ item }: { item: LedgerItem }) {
  const [pending, start] = useTransition();

  function remove() {
    if (!confirm("Apagar este lançamento?")) return;
    start(async () => {
      if (item.type === "transfer") await deleteTransfer(item.id);
      else await deleteTransaction(item.id);
    });
  }

  const isTransfer = item.type === "transfer";
  const sign = isTransfer ? "" : item.kind === "income" ? "+" : "−";
  const color = isTransfer
    ? "var(--color-fg-muted)"
    : item.kind === "income"
      ? "var(--color-success)"
      : "var(--color-danger)";

  const avatarBg = isTransfer
    ? "var(--color-bg-elevated)"
    : (item.category?.color ?? "var(--color-bg-elevated)");
  // Keep the user's chosen category emoji; only the absent-category fallback
  // becomes a lucide icon.
  const avatarContent = isTransfer ? (
    <Repeat size={15} style={{ color: "var(--color-fg-muted)" }} />
  ) : item.category?.emoji ? (
    item.category.emoji
  ) : item.kind === "income" ? (
    <TrendingUp size={15} style={{ color: "var(--color-success)" }} />
  ) : (
    <TrendingDown size={15} style={{ color: "var(--color-danger)" }} />
  );

  const title = isTransfer
    ? item.description || "Transferência"
    : item.description || item.category?.name || "(sem descrição)";

  const subtitle = isTransfer
    ? `${item.from ?? "?"} → ${item.to ?? "?"}`
    : `${item.category?.name ?? "Sem categoria"}${item.account ? ` · ${item.account.name}` : ""}`;

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
          <div className="flex items-center gap-1.5 truncate font-medium">
            <span className="truncate">{title}</span>
            {!isTransfer && item.installment ? (
              <span
                className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold"
                style={{ background: "var(--color-bg-elevated)", color: "var(--color-fg-subtle)" }}
              >
                {item.installment.number}/{item.installment.total}
              </span>
            ) : null}
          </div>
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
