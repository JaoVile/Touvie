"use client";

import { formatBRL } from "@/lib/utils";
import { useMemo, useState, useTransition } from "react";
import { type LedgerItem, TransactionRow } from "./TransactionRow";
import { deleteTransactions } from "./actions";

type Group = { date: string; items: LedgerItem[] };

function formatDateHeader(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

/**
 * Lista de lançamentos com MODO SELEÇÃO pra excluir em lote (limpar lixo de
 * import). Fora do modo, cada linha mantém o excluir-1 de sempre.
 */
export function SelectableLedger({ groups }: { groups: Group[] }) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((s) =>
      s.size === allItems.length ? new Set() : new Set(allItems.map((i) => i.id)),
    );
  }
  function exitSelect() {
    setSelecting(false);
    setSelected(new Set());
    setError(undefined);
  }

  // Impacto no saldo de apagar os selecionados: remove Σ(income) e Σ(expense),
  // então o saldo muda por (Σexpense − Σincome) dos marcados.
  const impact = useMemo(() => {
    let v = 0;
    for (const it of allItems) {
      if (!selected.has(it.id)) continue;
      v += it.kind === "expense" ? it.amount_cents : -it.amount_cents;
    }
    return v;
  }, [allItems, selected]);

  function removeSelected() {
    if (!selected.size || pending) return;
    if (!confirm(`Apagar ${selected.size} lançamento(s)? Não dá pra desfazer.`)) return;
    setError(undefined);
    start(async () => {
      const res = await deleteTransactions([...selected]);
      if (res.error) {
        setError(res.error);
        return;
      }
      exitSelect();
    });
  }

  const allSelected = selected.size > 0 && selected.size === allItems.length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        {selecting ? (
          <label
            className="flex items-center gap-2 text-xs"
            style={{ color: "var(--color-fg-muted)" }}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="size-4 accent-[var(--color-accent)]"
            />
            Selecionar todos ({allItems.length})
          </label>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={selecting ? exitSelect : () => setSelecting(true)}
          className="rounded-lg border px-3 py-1 text-xs font-medium"
          style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
        >
          {selecting ? "Cancelar" : "Selecionar"}
        </button>
      </div>

      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.date}>
            <h3
              className="mb-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-fg-subtle)" }}
            >
              {formatDateHeader(g.date)}
            </h3>
            <ul className="space-y-1.5">
              {g.items.map((it) => (
                <TransactionRow
                  key={it.id}
                  item={it}
                  selectable={selecting}
                  selected={selected.has(it.id)}
                  onToggle={() => toggle(it.id)}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {error ? (
        <p className="mt-2 text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}

      {selecting && selected.size ? (
        <div
          className="sticky bottom-4 mt-4 flex items-center justify-between gap-3 rounded-xl border p-3"
          style={{ background: "var(--color-bg-elevated)", borderColor: "var(--color-danger)" }}
        >
          <span className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
            {selected.size} selecionado(s) · saldo {impact >= 0 ? "+" : "−"}
            {formatBRL(Math.abs(impact))}
          </span>
          <button
            type="button"
            onClick={removeSelected}
            disabled={pending}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--color-danger)" }}
          >
            {pending ? "Apagando…" : `Excluir ${selected.size}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
