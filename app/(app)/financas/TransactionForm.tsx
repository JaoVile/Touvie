"use client";

import { useState, useTransition } from "react";
import { saveTransaction } from "./actions";

interface Account {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  kind: "income" | "expense";
  emoji: string | null;
}

interface Props {
  accounts: Account[];
  categories: Category[];
  defaultValues?: {
    id?: string;
    account_id?: string | null;
    category_id?: string | null;
    amount_cents?: number;
    kind?: "income" | "expense";
    occurred_on?: string;
    description?: string | null;
    is_recurring?: boolean;
    recurrence_day?: number;
    reminder_enabled?: boolean;
  };
  recurringMode?: boolean;
  onDone?: () => void;
}

export function TransactionForm({
  accounts,
  categories,
  defaultValues,
  recurringMode = false,
  onDone,
}: Props) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<"income" | "expense">(defaultValues?.kind ?? "expense");
  const [isRecurring, setIsRecurring] = useState<boolean>(
    defaultValues?.is_recurring ?? recurringMode,
  );

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
  const defaultDay = new Date().getDate();

  return (
    <form action={submit} className="space-y-3 text-sm">
      {defaultValues?.id ? <input type="hidden" name="id" value={defaultValues.id} /> : null}

      <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--color-card)" }}>
        {(["expense", "income"] as const).map((k) => (
          <label
            key={k}
            className="flex-1 cursor-pointer rounded-md py-1.5 text-center font-medium transition"
            style={{
              background: kind === k ? "var(--gradient-brand)" : "transparent",
              color: kind === k ? "white" : "var(--color-fg-muted)",
            }}
          >
            <input
              type="radio"
              name="kind"
              value={k}
              checked={kind === k}
              onChange={() => setKind(k)}
              className="sr-only"
            />
            {k === "expense" ? "💸 Despesa" : "💰 Receita"}
          </label>
        ))}
      </div>

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
        <input
          type="date"
          name="occurred_on"
          required
          defaultValue={defaultValues?.occurred_on ?? today}
          className={inputCls}
          style={inputStyle}
        />
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

      <select
        name="account_id"
        defaultValue={defaultValues?.account_id ?? ""}
        className={inputCls}
        style={inputStyle}
      >
        <option value="">— Sem conta —</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
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

      {!recurringMode ? (
        <label
          className="flex items-center gap-2 text-xs"
          style={{ color: "var(--color-fg-muted)" }}
        >
          <input
            type="checkbox"
            name="is_recurring"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Repetir todo mês
        </label>
      ) : (
        <input type="hidden" name="is_recurring" value="on" />
      )}

      {recurringMode || isRecurring ? (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            name="recurrence_day"
            min="1"
            max="31"
            required={recurringMode || isRecurring}
            placeholder="Dia do mês"
            defaultValue={defaultValues?.recurrence_day ?? defaultDay}
            className={inputCls}
            style={inputStyle}
          />
          <label
            className="flex items-center gap-2 text-xs"
            style={{ color: "var(--color-fg-muted)" }}
          >
            <input
              type="checkbox"
              name="reminder_enabled"
              defaultChecked={defaultValues?.reminder_enabled ?? false}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            Lembrete via Telegram
          </label>
        </div>
      ) : null}

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
