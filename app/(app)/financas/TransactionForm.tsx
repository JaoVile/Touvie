"use client";

import { DatePicker } from "@/components/DatePicker";
import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { useState, useTransition } from "react";
import { saveTransaction } from "./actions";

interface Category {
  id: string;
  name: string;
  kind: "income" | "expense";
  emoji: string | null;
}

type Mode = "expense" | "income";

interface Props {
  categories: Category[];
  defaultValues?: {
    id?: string;
    category_id?: string | null;
    amount_cents?: number;
    kind?: "income" | "expense";
    occurred_on?: string;
    description?: string | null;
  };
  onDone?: () => void;
}

export function TransactionForm({ categories, defaultValues, onDone }: Props) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<Mode>(defaultValues?.kind ?? "expense");

  const kind: "income" | "expense" = mode;
  const filteredCategories = categories.filter((c) => c.kind === kind);

  function submit(fd: FormData) {
    setError(undefined);
    start(async () => {
      const res = await saveTransaction(fd);
      if (res?.error) setError(res.error);
      else onDone?.();
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  const modeMeta: Record<Mode, { label: string; icon: LucideIcon }> = {
    expense: { label: "Saiu", icon: TrendingDown },
    income: { label: "Entrou", icon: TrendingUp },
  };

  return (
    <form action={submit} className="space-y-3 text-sm">
      {defaultValues?.id ? <input type="hidden" name="id" value={defaultValues.id} /> : null}

      <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--color-card)" }}>
        {(["expense", "income"] as Mode[]).map((m) => {
          const Icon = modeMeta[m].icon;
          return (
            <label
              key={m}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md py-1.5 text-center font-medium transition"
              style={{
                background: mode === m ? "var(--gradient-brand)" : "transparent",
                color: mode === m ? "white" : "var(--color-fg-muted)",
              }}
            >
              <input
                type="radio"
                name="mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                className="sr-only"
              />
              <Icon size={14} className="shrink-0" />
              {modeMeta[m].label}
            </label>
          );
        })}
      </div>

      <input type="hidden" name="kind" value={kind} />

      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          name="amount"
          step="0.01"
          min="0.01"
          required
          placeholder="Valor (R$)"
          defaultValue={
            defaultValues?.amount_cents != null ? (defaultValues.amount_cents / 100).toFixed(2) : ""
          }
          className={inputCls}
          style={inputStyle}
        />
        <DatePicker name="occurred_on" defaultValue={defaultValues?.occurred_on ?? today} />
      </div>

      <select
        name="category_id"
        defaultValue={defaultValues?.category_id ?? ""}
        className={inputCls}
        style={inputStyle}
        key={kind}
      >
        <option value="">— Sem categoria —</option>
        {filteredCategories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.emoji ? `${c.emoji} ` : ""}
            {c.name}
          </option>
        ))}
      </select>

      <input
        type="text"
        name="description"
        placeholder="Descrição (opcional)"
        maxLength={200}
        defaultValue={defaultValues?.description ?? ""}
        className={inputCls}
        style={inputStyle}
      />

      {error ? <p style={{ color: "var(--color-danger)" }}>{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        {pending ? "Salvando…" : defaultValues?.id ? "Atualizar" : "Adicionar"}
      </button>
    </form>
  );
}

const inputCls = "w-full rounded-lg border px-3 py-2 outline-none transition focus:ring-2";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
