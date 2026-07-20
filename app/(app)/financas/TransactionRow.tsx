"use client";

import { formatBRL } from "@/lib/utils";
import { Pencil, TrendingDown, TrendingUp } from "lucide-react";
import { useState, useTransition } from "react";
import { TransactionForm } from "./TransactionForm";
import { deleteTransaction } from "./actions";

export interface LedgerItem {
  id: string;
  amount_cents: number;
  kind: "income" | "expense";
  description: string | null;
  occurred_on: string;
  category_id: string | null;
  category: { name: string; emoji: string | null; color: string | null } | null;
}

type FormCategory = { id: string; name: string; kind: "income" | "expense"; emoji: string | null };

export function TransactionRow({
  item,
  categories = [],
  selectable = false,
  selected = false,
  onToggle,
}: {
  item: LedgerItem;
  categories?: FormCategory[];
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);

  function remove() {
    if (!confirm("Apagar este lançamento?")) return;
    start(async () => {
      await deleteTransaction(item.id);
    });
  }

  // Edição inline: abre o TransactionForm no lugar da linha, já preenchido; ao
  // salvar (a action revalida) fecha e a lista reflete o novo valor.
  if (editing && !selectable) {
    return (
      <li className="rounded-lg p-3" style={{ background: "var(--color-card)" }}>
        <TransactionForm
          categories={categories}
          defaultValues={{
            id: item.id,
            category_id: item.category_id,
            amount_cents: item.amount_cents,
            kind: item.kind,
            occurred_on: item.occurred_on,
            description: item.description,
          }}
          onDone={() => setEditing(false)}
        />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mt-2 w-full text-xs"
          style={{ color: "var(--color-fg-muted)" }}
        >
          cancelar
        </button>
      </li>
    );
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
      style={{
        background: "var(--color-card)",
        outline: selected ? "2px solid var(--color-accent)" : undefined,
        cursor: selectable ? "pointer" : undefined,
      }}
      onClick={selectable ? onToggle : undefined}
    >
      <div className="flex min-w-0 items-center gap-2">
        {selectable ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="size-4 shrink-0 accent-[var(--color-accent)]"
            aria-label="Selecionar lançamento"
          />
        ) : null}
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
      <div className="flex items-center gap-1">
        <span className="font-mono text-sm" style={{ color }}>
          {sign} {formatBRL(item.amount_cents)}
        </span>
        {selectable ? null : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded p-1 hover:opacity-80"
              style={{ color: "var(--color-fg-subtle)" }}
              aria-label="Editar lançamento"
            >
              <Pencil size={13} />
            </button>
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
          </>
        )}
      </div>
    </li>
  );
}
