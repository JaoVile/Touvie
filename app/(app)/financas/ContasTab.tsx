"use client";

import { DatePicker } from "@/components/DatePicker";
import { formatBRL } from "@/lib/utils";
import { CheckSquare, Square } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteBill, saveBill, toggleBillPaid } from "./actions";

interface Category {
  id: string;
  name: string;
  emoji: string | null;
}

interface Bill {
  id: string;
  title: string;
  amount_cents: number;
  due_date: string;
  paid_at: string | null;
  recurrence_rule: string | null;
  category_id: string | null;
  notes: string | null;
}

interface Props {
  bills: Bill[];
  categories: Category[];
  today: string;
}

export function ContasTab({ bills, categories, today }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function billStatus(b: Bill): "paga" | "vencida" | "hoje" | "pendente" {
    if (b.paid_at) return "paga";
    if (b.due_date < today) return "vencida";
    if (b.due_date === today) return "hoje";
    return "pendente";
  }

  // Only offer filters for categories that actually have bills (plus a bucket
  // for the uncategorised ones), keeping the chip row short and relevant.
  const usedCatIds = new Set(bills.map((b) => b.category_id));
  const filterCats = categories.filter((c) => usedCatIds.has(c.id));
  const hasUncategorised = bills.some((b) => !b.category_id);

  const filtered =
    catFilter === null
      ? bills
      : catFilter === "__none__"
        ? bills.filter((b) => !b.category_id)
        : bills.filter((b) => b.category_id === catFilter);

  const sorted = [...filtered].sort((a, b) => {
    if (a.paid_at && !b.paid_at) return 1;
    if (!a.paid_at && b.paid_at) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
          {filtered.filter((b) => !b.paid_at).length} pendente(s) ·{" "}
          {formatBRL(filtered.filter((b) => !b.paid_at).reduce((s, b) => s + b.amount_cents, 0))} a
          pagar
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
          + Nova conta
        </button>
      </div>

      {filterCats.length > 0 || hasUncategorised ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          <FilterChip
            label="Todas"
            active={catFilter === null}
            onClick={() => setCatFilter(null)}
          />
          {filterCats.map((c) => (
            <FilterChip
              key={c.id}
              label={`${c.emoji ? `${c.emoji} ` : ""}${c.name}`}
              active={catFilter === c.id}
              onClick={() => setCatFilter(c.id)}
            />
          ))}
          {hasUncategorised ? (
            <FilterChip
              label="Sem categoria"
              active={catFilter === "__none__"}
              onClick={() => setCatFilter("__none__")}
            />
          ) : null}
        </div>
      ) : null}

      {showForm || editing ? (
        <BillForm
          bill={editing}
          categories={categories}
          today={today}
          onDone={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      ) : null}

      {sorted.length === 0 ? (
        <p
          className="rounded-lg border p-4 text-sm text-center"
          style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
        >
          {catFilter === null ? "Nenhuma conta cadastrada." : "Nenhuma conta nesta categoria."}
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((b) => {
            const status = billStatus(b);
            const cat = categories.find((c) => c.id === b.category_id);
            return (
              <li
                key={b.id}
                className="flex items-center gap-3 rounded-lg border p-3"
                style={{
                  borderColor:
                    status === "vencida"
                      ? "var(--color-danger)"
                      : status === "hoje"
                        ? "var(--color-accent)"
                        : "var(--color-border)",
                  opacity: status === "paga" ? 0.55 : 1,
                  background: "var(--color-card)",
                }}
              >
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => start(() => toggleBillPaid(b.id, !b.paid_at))}
                  className="shrink-0 leading-none transition-transform active:scale-90"
                  title={b.paid_at ? "Marcar como pendente" : "Marcar como pago"}
                  style={{ color: b.paid_at ? "var(--color-success)" : "var(--color-fg-subtle)" }}
                >
                  {b.paid_at ? <CheckSquare size={20} /> : <Square size={20} />}
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium"
                    style={{ textDecoration: status === "paga" ? "line-through" : "none" }}
                  >
                    {cat?.emoji ? <span className="mr-1">{cat.emoji}</span> : null}
                    {b.title}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
                    {formatDateLabel(b.due_date)}
                    {b.recurrence_rule ? " · recorrente" : ""}
                    {b.notes ? ` · ${b.notes}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className="font-mono text-sm font-semibold"
                    style={{
                      color: status === "vencida" ? "var(--color-danger)" : "var(--color-fg)",
                    }}
                  >
                    {formatBRL(b.amount_cents)}
                  </span>
                  <StatusChip status={status} />
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(b);
                      setShowForm(false);
                    }}
                    className="rounded px-2 py-1 text-xs"
                    style={{ color: "var(--color-accent)" }}
                  >
                    editar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm("Apagar conta?")) return;
                      start(() => deleteBill(b.id));
                    }}
                    className="rounded px-2 py-1 text-xs"
                    style={{ color: "var(--color-danger)" }}
                  >
                    apagar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: "paga" | "vencida" | "hoje" | "pendente" }) {
  const map = {
    paga: { label: "paga", color: "var(--color-success)" },
    vencida: { label: "vencida", color: "var(--color-danger)" },
    hoje: { label: "vence hoje", color: "var(--color-accent)" },
    pendente: { label: "pendente", color: "var(--color-fg-muted)" },
  };
  const { label, color } = map[status];
  return (
    <span
      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ color, border: `1px solid ${color}` }}
    >
      {label}
    </span>
  );
}

function formatDateLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  const months = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  return `${Number.parseInt(d)} de ${months[Number.parseInt(m) - 1]}`;
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition"
      style={{
        borderColor: active ? "var(--color-accent)" : "var(--color-border)",
        background: active ? "var(--color-accent)" : "transparent",
        color: active ? "white" : "var(--color-fg-muted)",
      }}
    >
      {label}
    </button>
  );
}

function BillForm({
  bill,
  categories,
  today,
  onDone,
}: {
  bill: Bill | null;
  categories: Category[];
  today: string;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  async function handleSubmit(fd: FormData) {
    start(async () => {
      const res = await saveBill(fd);
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
      {bill ? <input type="hidden" name="id" value={bill.id} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label
            htmlFor="bill-title"
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Título *
          </label>
          <input
            id="bill-title"
            name="title"
            defaultValue={bill?.title ?? ""}
            required
            className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          />
        </div>
        <div>
          <label
            htmlFor="bill-amount"
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Valor (R$) *
          </label>
          <input
            id="bill-amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={bill ? (bill.amount_cents / 100).toFixed(2) : ""}
            required
            className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          />
        </div>
        <div>
          <span
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Vencimento *
          </span>
          <DatePicker name="due_date" defaultValue={bill?.due_date ?? today} />
        </div>
        <div>
          <label
            htmlFor="bill-category"
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Categoria
          </label>
          <select
            id="bill-category"
            name="category_id"
            defaultValue={bill?.category_id ?? ""}
            className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          >
            <option value="">— sem categoria —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="bill-recurrence"
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Recorrência
          </label>
          <select
            id="bill-recurrence"
            name="recurrence_rule"
            defaultValue={bill?.recurrence_rule ?? ""}
            className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          >
            <option value="">Única</option>
            <option value="monthly">Mensal</option>
          </select>
        </div>
        <div className="col-span-2">
          <label
            htmlFor="bill-notes"
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Observações
          </label>
          <input
            id="bill-notes"
            name="notes"
            defaultValue={bill?.notes ?? ""}
            maxLength={300}
            className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          />
        </div>
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
          {pending ? "Salvando…" : bill ? "Salvar" : "Criar"}
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
