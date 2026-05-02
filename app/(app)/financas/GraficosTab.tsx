import { GlassCard } from "@/components/glass/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils";
import { Charts } from "./Charts";

interface Category {
  id: string;
  name: string;
  kind: "income" | "expense";
  emoji: string | null;
  color: string | null;
}

interface Props {
  userId: string;
  categories: Category[];
}

export async function GraficosTab({ userId, categories }: Props) {
  const supabase = await createClient();
  const now = new Date();

  // Mês atual: pizza de despesas por categoria
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // 6 meses: linha de receita/despesa
  const sixStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const { data: monthRows } = await supabase
    .from("transactions")
    .select("amount_cents, kind, category_id")
    .eq("user_id", userId)
    .eq("is_recurring", false)
    .gte("occurred_on", monthStart.toISOString().slice(0, 10))
    .lte("occurred_on", monthEnd.toISOString().slice(0, 10));

  const { data: sixRows } = await supabase
    .from("transactions")
    .select("amount_cents, kind, occurred_on")
    .eq("user_id", userId)
    .eq("is_recurring", false)
    .gte("occurred_on", sixStart.toISOString().slice(0, 10));

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // Pizza data
  const expensesByCat = new Map<string, number>();
  for (const t of monthRows ?? []) {
    if (t.kind !== "expense") continue;
    const key = t.category_id ?? "__none__";
    expensesByCat.set(key, (expensesByCat.get(key) ?? 0) + t.amount_cents);
  }
  const pieData = Array.from(expensesByCat.entries())
    .map(([catId, cents]) => {
      const cat = catId === "__none__" ? null : categoryMap.get(catId);
      return {
        name: cat ? `${cat.emoji ?? ""} ${cat.name}`.trim() : "Sem categoria",
        value: cents,
        color: cat?.color ?? "#64748b",
      };
    })
    .sort((a, b) => b.value - a.value);

  const totalExpense = pieData.reduce((s, p) => s + p.value, 0);

  // Line data — 6 meses
  const lineBuckets = new Map<string, { income: number; expense: number }>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    lineBuckets.set(key, { income: 0, expense: 0 });
  }
  for (const t of sixRows ?? []) {
    const key = t.occurred_on.slice(0, 7);
    const bucket = lineBuckets.get(key);
    if (!bucket) continue;
    if (t.kind === "income") bucket.income += t.amount_cents;
    else bucket.expense += t.amount_cents;
  }
  const lineData = Array.from(lineBuckets.entries()).map(([key, b]) => {
    const [y, m] = key.split("-").map(Number);
    const monthLabel = new Date(y, m - 1, 1)
      .toLocaleDateString("pt-BR", { month: "short" })
      .replace(".", "");
    return {
      month: `${monthLabel}/${String(y).slice(2)}`,
      receita: b.income / 100,
      despesa: b.expense / 100,
      saldo: (b.income - b.expense) / 100,
    };
  });

  return (
    <div className="grid gap-4">
      <GlassCard>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-sm font-semibold">Despesas do mês por categoria</h2>
          <span className="font-mono text-xs" style={{ color: "var(--color-fg-muted)" }}>
            Total: {formatBRL(totalExpense)}
          </span>
        </div>
        {pieData.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
            Sem despesas este mês.
          </p>
        ) : (
          <Charts
            kind="pie"
            data={pieData.map((p) => ({ name: p.name, value: p.value / 100, color: p.color }))}
          />
        )}
      </GlassCard>

      <GlassCard>
        <h2 className="mb-3 text-sm font-semibold">Fluxo dos últimos 6 meses</h2>
        {lineData.every((d) => d.receita === 0 && d.despesa === 0) ? (
          <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
            Sem dados nos últimos 6 meses.
          </p>
        ) : (
          <Charts kind="line" data={lineData} />
        )}
      </GlassCard>
    </div>
  );
}
