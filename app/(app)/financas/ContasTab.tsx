"use client";

import { DatePicker } from "@/components/DatePicker";
import { ACCOUNT_KIND_LABELS, type AccountKind, availableCredit } from "@/lib/finance";
import { formatBRL } from "@/lib/utils";
import { CheckSquare, CreditCard as CreditCardIcon, Square } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteBill, payCardInvoice, saveBill, toggleBillPaid } from "./actions";

interface Account {
  id: string;
  name: string;
  kind: AccountKind;
}

interface CreditCard {
  id: string;
  name: string;
  current_cents: number;
  credit_limit_cents: number | null;
  due_day: number | null;
  closing_day: number | null;
  faturaAberta: number;
}

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
  creditCards?: CreditCard[];
  accounts?: Account[];
}

export function ContasTab({ bills, categories, today, creditCards = [], accounts = [] }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [catFilter, setCatFilter] = useState<string | null>(null);
  // Bill aguardando escolha de conta-origem ao ser marcada como paga (só quando
  // há mais de uma conta — com 0 ou 1 conta resolvemos sem perguntar).
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [pending, start] = useTransition();

  // Marca uma conta como paga. Com uma única conta, debita dela direto; com
  // várias, abre o seletor; sem nenhuma, só registra a data (sem lançamento).
  function markPaid(b: Bill) {
    if (accounts.length === 0) {
      start(() => toggleBillPaid(b.id, true));
    } else if (accounts.length === 1) {
      start(() => toggleBillPaid(b.id, true, accounts[0].id));
    } else {
      setPayingBill(b);
    }
  }

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
      {creditCards.length > 0 ? (
        <CreditCardsSection
          cards={creditCards}
          accounts={accounts.filter((a) => a.kind !== "credit")}
        />
      ) : null}

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
                  onClick={() =>
                    b.paid_at ? start(() => toggleBillPaid(b.id, false)) : markPaid(b)
                  }
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

      {payingBill ? (
        <PayAccountPicker
          bill={payingBill}
          accounts={accounts}
          disabled={pending}
          onPick={(accountId) => {
            const billId = payingBill.id;
            setPayingBill(null);
            start(() => toggleBillPaid(billId, true, accountId));
          }}
          onCancel={() => setPayingBill(null)}
        />
      ) : null}
    </div>
  );
}

function PayAccountPicker({
  bill,
  accounts,
  disabled,
  onPick,
  onCancel,
}: {
  bill: { title: string; amount_cents: number };
  accounts: Account[];
  disabled: boolean;
  onPick: (accountId: string) => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onCancel}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div
        className="w-full max-w-xs rounded-xl border p-4 space-y-3"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-sm font-semibold">Pagar com qual conta?</p>
          <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
            {bill.title} · {formatBRL(bill.amount_cents)}
          </p>
        </div>
        <ul className="space-y-1.5">
          {accounts.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(a.id)}
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition hover:opacity-80 disabled:opacity-50"
                style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
              >
                <span className="font-medium">{a.name}</span>
                <span className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>
                  {ACCOUNT_KIND_LABELS[a.kind]}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-lg border px-4 py-1.5 text-sm hover:opacity-80"
          style={{ borderColor: "var(--color-border)" }}
        >
          Cancelar
        </button>
      </div>
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

function CreditCardsSection({ cards, accounts }: { cards: CreditCard[]; accounts: Account[] }) {
  const [paying, setPaying] = useState<CreditCard | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2">
      <h2
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        <span className="flex items-center gap-1.5">
          <CreditCardIcon size={13} />
          Cartões
        </span>
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {cards.map((c) => {
          const limit = c.credit_limit_cents;
          const available = availableCredit(limit, c.current_cents);
          const used = limit != null ? Math.max(limit - (available ?? 0), 0) : 0;
          const usedPct = limit && limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
          const danger = usedPct >= 90;
          return (
            <div
              key={c.id}
              className="rounded-xl border p-3"
              style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <CreditCardIcon size={14} />
                  {c.name}
                </span>
                {c.due_day ? (
                  <span className="text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
                    vence dia {c.due_day}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span
                  className="text-[10px] uppercase tracking-wide"
                  style={{ color: "var(--color-fg-subtle)" }}
                >
                  Fatura aberta
                </span>
                <span
                  className="font-mono text-base font-semibold"
                  style={{ color: "var(--color-danger)" }}
                >
                  {formatBRL(c.faturaAberta)}
                </span>
              </div>
              {limit != null ? (
                <>
                  <div
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
                    style={{ background: "var(--color-bg-elevated)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${usedPct}%`,
                        background: danger ? "var(--color-danger)" : "var(--gradient-brand)",
                      }}
                    />
                  </div>
                  <div
                    className="mt-1 flex justify-between text-[10px]"
                    style={{ color: "var(--color-fg-subtle)" }}
                  >
                    <span>disponível {formatBRL(available ?? 0)}</span>
                    <span>limite {formatBRL(limit)}</span>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
                  Defina limite/fechamento no Setup para ver o disponível.
                </p>
              )}
              {c.faturaAberta > 0 && accounts.length > 0 ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setPaying(c)}
                  className="mt-2 w-full rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:opacity-80 disabled:opacity-50"
                  style={{ borderColor: "var(--color-accent)", color: "var(--color-accent)" }}
                >
                  Pagar fatura
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {paying ? (
        <PayInvoiceModal
          card={paying}
          accounts={accounts}
          disabled={pending}
          onPay={(fromAccountId, amountReais) => {
            const cardId = paying.id;
            setPaying(null);
            start(async () => {
              await payCardInvoice(cardId, fromAccountId, amountReais);
            });
          }}
          onCancel={() => setPaying(null)}
        />
      ) : null}
    </div>
  );
}

function PayInvoiceModal({
  card,
  accounts,
  disabled,
  onPay,
  onCancel,
}: {
  card: CreditCard;
  accounts: Account[];
  disabled: boolean;
  onPay: (fromAccountId: string, amountReais: number) => void;
  onCancel: () => void;
}) {
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState((card.faturaAberta / 100).toFixed(2));
  const [error, setError] = useState("");

  function submit() {
    const value = Number.parseFloat(amount.replace(",", "."));
    if (!fromId) return setError("Escolha a conta de origem");
    if (!Number.isFinite(value) || value <= 0) return setError("Valor deve ser maior que zero");
    onPay(fromId, value);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onCancel}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div
        className="w-full max-w-xs rounded-xl border p-4 space-y-3"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-sm font-semibold">Pagar fatura</p>
          <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
            {card.name} · fatura {formatBRL(card.faturaAberta)}
          </p>
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Pagar com
          </label>
          <select
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Valor (R$)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          />
        </div>
        {error ? (
          <p className="text-xs" style={{ color: "var(--color-danger)" }}>
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={submit}
            className="flex-1 rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            Pagar
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border px-4 py-1.5 text-sm hover:opacity-80"
            style={{ borderColor: "var(--color-border)" }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
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
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Título *
          </label>
          <input
            name="title"
            defaultValue={bill?.title ?? ""}
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
            Valor (R$) *
          </label>
          <input
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
          <label
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Vencimento *
          </label>
          <DatePicker name="due_date" defaultValue={bill?.due_date ?? today} />
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
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Recorrência
          </label>
          <select
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
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Observações
          </label>
          <input
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
