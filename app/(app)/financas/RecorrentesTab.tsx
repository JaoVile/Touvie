import { GlassCard } from "@/components/glass/GlassCard";
import { parseRecurrenceRule, recurrenceLabel } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils";
import { RecurringRow } from "./RecurringRow";
import { TransactionForm } from "./TransactionForm";

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

export async function RecorrentesTab({ userId, accounts, categories }: Props) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("transactions")
    .select(
      "id, amount_cents, kind, occurred_on, description, account_id, category_id, recurrence_rule, reminder_enabled",
    )
    .eq("user_id", userId)
    .eq("is_recurring", true)
    .order("kind", { ascending: false })
    .order("amount_cents", { ascending: false });

  const recurring = rows ?? [];
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const monthlyExpense = recurring
    .filter((r) => r.kind === "expense")
    .reduce((s, r) => s + r.amount_cents, 0);
  const monthlyIncome = recurring
    .filter((r) => r.kind === "income")
    .reduce((s, r) => s + r.amount_cents, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <Stat
            label="Receitas/mês"
            value={formatBRL(monthlyIncome)}
            color="var(--color-success)"
          />
          <Stat
            label="Despesas/mês"
            value={formatBRL(monthlyExpense)}
            color="var(--color-danger)"
          />
        </div>

        <GlassCard>
          {recurring.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Nenhuma recorrência cadastrada. Adicione contas que se repetem todo mês — aluguel,
              salário, assinaturas — pra ter visibilidade do compromisso fixo.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {recurring.map((r) => {
                const cat = r.category_id ? (categoryMap.get(r.category_id) ?? null) : null;
                const acc = r.account_id ? (accountMap.get(r.account_id) ?? null) : null;
                return (
                  <RecurringRow
                    key={r.id}
                    tx={{
                      id: r.id,
                      amount_cents: r.amount_cents,
                      kind: r.kind as "income" | "expense",
                      description: r.description,
                      reminder_enabled: r.reminder_enabled,
                      day: parseRecurrenceRule(r.recurrence_rule)?.day ?? null,
                      label: recurrenceLabel(r.recurrence_rule),
                      category: cat ? { name: cat.name, emoji: cat.emoji, color: cat.color } : null,
                      account: acc ? { name: acc.name } : null,
                    }}
                  />
                );
              })}
            </ul>
          )}
        </GlassCard>
      </div>

      <GlassCard className="lg:sticky lg:top-20 lg:self-start">
        <h2 className="mb-3 text-sm font-semibold">Nova recorrência</h2>
        <TransactionForm accounts={accounts} categories={categories} recurringMode />
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
