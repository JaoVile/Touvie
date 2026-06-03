import { GlassCard } from "@/components/glass/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils";
import { LancamentosFilters } from "./LancamentosFilters";
import { TransactionForm } from "./TransactionForm";
import { type LedgerItem, TransactionRow } from "./TransactionRow";

interface Category {
  id: string;
  name: string;
  kind: "income" | "expense";
  emoji: string | null;
  color: string | null;
}

interface Filters {
  categoryId: string | null;
  kind: "income" | "expense" | null;
  q: string | null;
}

interface Props {
  userId: string;
  categories: Category[];
  month: string; // YYYY-MM
  filters: Filters;
}

export async function LancamentosTab({ userId, categories, month, filters }: Props) {
  const supabase = await createClient();
  const [y, m] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const monthEnd = new Date(y, m, 0).toISOString().slice(0, 10);

  let txQuery = supabase
    .from("transactions")
    .select("id, amount_cents, kind, occurred_on, description, category_id")
    .eq("user_id", userId)
    .eq("is_recurring", false)
    .gte("occurred_on", monthStart)
    .lte("occurred_on", monthEnd)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.categoryId) txQuery = txQuery.eq("category_id", filters.categoryId);
  if (filters.kind) txQuery = txQuery.eq("kind", filters.kind);
  if (filters.q) txQuery = txQuery.ilike("description", `%${filters.q}%`);

  const { data: txRows } = await txQuery;

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const totals = (txRows ?? []).reduce(
    (acc, t) => {
      if (t.kind === "income") acc.income += t.amount_cents;
      else acc.expense += t.amount_cents;
      return acc;
    },
    { income: 0, expense: 0 },
  );
  const net = totals.income - totals.expense;

  const byDate = new Map<string, LedgerItem[]>();
  for (const t of txRows ?? []) {
    const cat = t.category_id ? categoryMap.get(t.category_id) : null;
    const arr = byDate.get(t.occurred_on) ?? [];
    arr.push({
      id: t.id,
      amount_cents: t.amount_cents,
      kind: t.kind as "income" | "expense",
      description: t.description,
      category: cat ? { name: cat.name, emoji: cat.emoji, color: cat.color } : null,
    });
    byDate.set(t.occurred_on, arr);
  }
  const dates = Array.from(byDate.keys()).sort((a, b) => (a < b ? 1 : -1));
  const hasItems = (txRows ?? []).length > 0;
  const hasFilters = !!(filters.categoryId || filters.kind || filters.q);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-4">
        <LancamentosFilters categories={categories} month={month} filters={filters} />

        <div className="grid gap-2 sm:grid-cols-3">
          <Stat label="Entrou" value={formatBRL(totals.income)} color="var(--color-success)" />
          <Stat label="Saiu" value={formatBRL(totals.expense)} color="var(--color-danger)" />
          <Stat
            label="Saldo do mês"
            value={formatBRL(net)}
            color={net >= 0 ? "var(--color-success)" : "var(--color-danger)"}
          />
        </div>

        <GlassCard>
          {!hasItems ? (
            <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
              {hasFilters
                ? "Nenhum lançamento com esses filtros."
                : "Nenhum lançamento neste mês. Use o formulário ao lado pra adicionar."}
            </p>
          ) : (
            <div className="space-y-4">
              {dates.map((date) => (
                <div key={date}>
                  <h3
                    className="mb-2 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-fg-subtle)" }}
                  >
                    {formatDateHeader(date)}
                  </h3>
                  <ul className="space-y-1.5">
                    {(byDate.get(date) ?? []).map((it) => (
                      <TransactionRow key={it.id} item={it} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      <GlassCard className="lg:sticky lg:top-20 lg:self-start">
        <h2 className="mb-3 text-sm font-semibold">Novo lançamento</h2>
        <TransactionForm categories={categories} />
      </GlassCard>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      <div
        className="text-[10px] uppercase tracking-wide"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        {label}
      </div>
      <div className="mt-0.5 font-mono text-lg" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function formatDateHeader(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}
