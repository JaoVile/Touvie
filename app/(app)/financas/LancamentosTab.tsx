import { GlassCard } from "@/components/glass/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils";
import { TransactionForm } from "./TransactionForm";
import { TransactionRow } from "./TransactionRow";

interface Account {
  id: string;
  name: string;
  kind: string;
}
interface Category {
  id: string;
  name: string;
  kind: "income" | "expense";
  emoji: string | null;
  color: string | null;
}

interface Props {
  userId: string;
  accounts: Account[];
  categories: Category[];
}

export async function LancamentosTab({ userId, accounts, categories }: Props) {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { data: rows } = await supabase
    .from("transactions")
    .select("id, amount_cents, kind, occurred_on, description, account_id, category_id")
    .eq("user_id", userId)
    .eq("is_recurring", false)
    .gte("occurred_on", monthStart)
    .lte("occurred_on", monthEnd)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  const txs = rows ?? [];
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const totals = txs.reduce(
    (acc, t) => {
      if (t.kind === "income") acc.income += t.amount_cents;
      else acc.expense += t.amount_cents;
      return acc;
    },
    { income: 0, expense: 0 },
  );
  const net = totals.income - totals.expense;

  // Group by date
  const byDate = new Map<string, typeof txs>();
  for (const t of txs) {
    const arr = byDate.get(t.occurred_on) ?? [];
    arr.push(t);
    byDate.set(t.occurred_on, arr);
  }
  const dates = Array.from(byDate.keys()).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <Stat label="Receitas" value={formatBRL(totals.income)} color="var(--color-success)" />
          <Stat label="Despesas" value={formatBRL(totals.expense)} color="var(--color-danger)" />
          <Stat
            label="Saldo do mês"
            value={formatBRL(net)}
            color={net >= 0 ? "var(--color-success)" : "var(--color-danger)"}
          />
        </div>

        <GlassCard>
          {txs.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Nenhum lançamento este mês. Use o formulário ao lado pra adicionar.
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
                    {(byDate.get(date) ?? []).map((t) => (
                      <TransactionRow
                        key={t.id}
                        tx={{
                          id: t.id,
                          amount_cents: t.amount_cents,
                          kind: t.kind as "income" | "expense",
                          description: t.description,
                          category: t.category_id
                            ? (() => {
                                const c = categoryMap.get(t.category_id);
                                return c ? { name: c.name, emoji: c.emoji, color: c.color } : null;
                              })()
                            : null,
                          account: t.account_id
                            ? (() => {
                                const a = accountMap.get(t.account_id);
                                return a ? { name: a.name } : null;
                              })()
                            : null,
                        }}
                      />
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
        <TransactionForm accounts={accounts} categories={categories} />
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
