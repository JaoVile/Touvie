"use client";

import { formatBRL } from "@/lib/utils";
import { AlertTriangle, Zap } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteEnvelope, saveEnvelope } from "./actions";

interface Category {
  id: string;
  name: string;
  emoji: string | null;
}

interface Envelope {
  id: string;
  name: string;
  emoji: string | null;
  category_id: string | null;
  month: string;
  limit_cents: number;
  spent_cents: number;
}

interface Props {
  envelopes: Envelope[];
  categories: Category[];
  currentMonth: string;
}

export function CaixinhasTab({ envelopes, categories, currentMonth }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Envelope | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
          Orçamento de {monthLabel(currentMonth)} · {envelopes.length} caixinha(s)
        </p>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          + Nova caixinha
        </button>
      </div>

      {showForm || editing ? (
        <EnvelopeForm
          envelope={editing}
          categories={categories}
          currentMonth={currentMonth}
          onDone={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      ) : null}

      {envelopes.length === 0 ? (
        <p
          className="rounded-lg border p-4 text-sm text-center"
          style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
        >
          Nenhuma caixinha para {monthLabel(currentMonth)}. Crie uma para definir um limite de gasto
          por categoria.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {envelopes.map((e) => {
            const pct =
              e.limit_cents > 0 ? Math.min((e.spent_cents / e.limit_cents) * 100, 100) : 0;
            const over = e.spent_cents > e.limit_cents;
            const warn = pct >= 80 && !over;
            const remaining = e.limit_cents - e.spent_cents;

            return (
              <div
                key={e.id}
                className="rounded-lg border p-4"
                style={{
                  borderColor: over
                    ? "var(--color-danger)"
                    : warn
                      ? "var(--color-accent)"
                      : "var(--color-border)",
                  background: "var(--color-card)",
                }}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">
                      {e.emoji ? <span className="mr-1.5">{e.emoji}</span> : null}
                      {e.name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
                      {formatBRL(e.spent_cents)} de {formatBRL(e.limit_cents)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(e);
                        setShowForm(false);
                      }}
                      className="rounded px-1.5 py-0.5 text-xs"
                      style={{ color: "var(--color-accent)" }}
                    >
                      editar
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm("Apagar caixinha?")) return;
                        start(() => deleteEnvelope(e.id));
                      }}
                      className="rounded px-1.5 py-0.5 text-xs"
                      style={{ color: "var(--color-danger)" }}
                    >
                      apagar
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  className="h-2 w-full overflow-hidden rounded-full"
                  style={{ background: "var(--color-border)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: over
                        ? "var(--color-danger)"
                        : warn
                          ? "var(--color-accent)"
                          : "var(--gradient-brand)",
                    }}
                  />
                </div>

                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span
                    className="flex items-center gap-1"
                    style={{
                      color: over
                        ? "var(--color-danger)"
                        : warn
                          ? "var(--color-accent)"
                          : "var(--color-fg-subtle)",
                    }}
                  >
                    {over ? (
                      <>
                        <AlertTriangle size={12} className="shrink-0" />
                        {`excedeu ${formatBRL(Math.abs(remaining))}`}
                      </>
                    ) : warn ? (
                      <>
                        <Zap size={12} className="shrink-0" />
                        {`${Math.round(pct)}% usado`}
                      </>
                    ) : (
                      `${Math.round(pct)}% usado`
                    )}
                  </span>
                  <span style={{ color: "var(--color-fg-muted)" }}>
                    {remaining >= 0
                      ? `sobram ${formatBRL(remaining)}`
                      : `excedeu ${formatBRL(-remaining)}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  const names = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return `${names[Number.parseInt(m) - 1]}/${y}`;
}

function EnvelopeForm({
  envelope,
  categories,
  currentMonth,
  onDone,
}: {
  envelope: Envelope | null;
  categories: Category[];
  currentMonth: string;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  async function handleSubmit(fd: FormData) {
    start(async () => {
      const res = await saveEnvelope(fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <form
      action={handleSubmit}
      className="rounded-lg border p-4 space-y-3"
      style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
    >
      {envelope ? <input type="hidden" name="id" value={envelope.id} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Nome *
          </label>
          <input
            name="name"
            defaultValue={envelope?.name ?? ""}
            required
            className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Emoji
          </label>
          <input
            name="emoji"
            defaultValue={envelope?.emoji ?? ""}
            maxLength={8}
            className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Limite mensal (R$) *
          </label>
          <input
            name="limit"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={envelope ? (envelope.limit_cents / 100).toFixed(2) : ""}
            className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Categoria
          </label>
          <select
            name="category_id"
            defaultValue={envelope?.category_id ?? ""}
            className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          >
            <option value="">— sem categoria —</option>
            {categories
              .filter((c) => true)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
          </select>
        </div>
        <input type="hidden" name="month" value={envelope?.month ?? currentMonth} />
      </div>
      {error ? (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          {pending ? "Salvando…" : envelope ? "Salvar" : "Criar"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border px-4 py-1.5 text-sm hover:opacity-80"
          style={{ borderColor: "var(--color-border)" }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
