"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

interface Account {
  id: string;
  name: string;
}
interface Category {
  id: string;
  name: string;
  emoji: string | null;
}
interface Filters {
  accountId: string | null;
  categoryId: string | null;
  kind: "income" | "expense" | null;
  q: string | null;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]}/${String(y).slice(2)}`;
}

export function LancamentosFilters({
  accounts,
  categories,
  month,
  filters,
}: {
  accounts: Account[];
  categories: Category[];
  month: string;
  filters: Filters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    params.set("t", "lancamentos");
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") params.delete(k);
      else params.set(k, v);
    }
    start(() => router.push(`${pathname}?${params.toString()}`));
  }

  const hasFilters = !!(filters.accountId || filters.categoryId || filters.kind || filters.q);

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-xl p-2"
      style={{
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {/* Navegação de mês */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => update({ m: shiftMonth(month, -1) })}
          className="rounded-md px-2 py-1 text-sm hover:opacity-70"
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <span className="min-w-[3.5rem] text-center text-sm font-semibold capitalize">
          {monthLabel(month)}
        </span>
        <button
          type="button"
          onClick={() => update({ m: shiftMonth(month, 1) })}
          className="rounded-md px-2 py-1 text-sm hover:opacity-70"
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>

      <div className="h-5 w-px" style={{ background: "var(--color-border)" }} />

      <select
        value={filters.kind ?? ""}
        onChange={(e) => update({ kind: e.target.value || null })}
        className={selCls}
        style={selStyle}
      >
        <option value="">Tipo</option>
        <option value="expense">💸 Despesas</option>
        <option value="income">💰 Receitas</option>
      </select>

      <select
        value={filters.categoryId ?? ""}
        onChange={(e) => update({ cat: e.target.value || null })}
        className={selCls}
        style={selStyle}
      >
        <option value="">Categoria</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.emoji ? `${c.emoji} ` : ""}
            {c.name}
          </option>
        ))}
      </select>

      <select
        value={filters.accountId ?? ""}
        onChange={(e) => update({ acc: e.target.value || null })}
        className={selCls}
        style={selStyle}
      >
        <option value="">Conta</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      <input
        type="search"
        defaultValue={filters.q ?? ""}
        placeholder="Buscar…"
        onKeyDown={(e) => {
          if (e.key === "Enter") update({ q: (e.target as HTMLInputElement).value || null });
        }}
        onBlur={(e) => {
          if ((e.target.value || null) !== filters.q) update({ q: e.target.value || null });
        }}
        className={`${selCls} min-w-[8rem] flex-1`}
        style={selStyle}
      />

      {hasFilters ? (
        <button
          type="button"
          onClick={() => update({ acc: null, cat: null, kind: null, q: null })}
          className="rounded-md px-2 py-1 text-xs hover:opacity-70"
          style={{ color: "var(--color-accent)" }}
        >
          limpar
        </button>
      ) : null}
    </div>
  );
}

const selCls = "rounded-lg border px-2 py-1 text-sm outline-none transition focus:ring-2";
const selStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
