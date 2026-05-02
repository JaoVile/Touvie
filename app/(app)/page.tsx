import { GlassCard } from "@/components/glass/GlassCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { addDaysISO, formatDateBRT, greetingForHour, todayBRTISO, todayWeekday } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const weekday = todayWeekday();
  const today = todayBRTISO();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const since90 = addDaysISO(today, -90);

  const [dailyRes, goalsRes, tasksRes, txRes, completionsRes] = await Promise.all([
    supabase
      .from("routine_daily")
      .select("id, time_slot, title, emoji")
      .eq("user_id", userId)
      .eq("active", true)
      .order("time_slot", { ascending: true }),
    supabase
      .from("goals")
      .select("id, title")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("sort_order"),
    supabase
      .from("tasks")
      .select("id, title, done, due_date")
      .eq("user_id", userId)
      .eq("done", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(6),
    supabase
      .from("transactions")
      .select("amount_cents, kind")
      .eq("user_id", userId)
      .eq("is_recurring", false)
      .gte("occurred_on", monthStart)
      .lte("occurred_on", monthEnd),
    supabase
      .from("routine_completions")
      .select("routine_id, completed_on")
      .eq("user_id", userId)
      .gte("completed_on", since90)
      .order("completed_on", { ascending: false }),
  ]);

  const routine = dailyRes.data ?? [];
  const goals = goalsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const txs = txRes.data ?? [];
  const completions = completionsRes.data ?? [];

  const monthIncome = txs.reduce((s, t) => (t.kind === "income" ? s + t.amount_cents : s), 0);
  const monthExpense = txs.reduce((s, t) => (t.kind === "expense" ? s + t.amount_cents : s), 0);
  const monthNet = monthIncome - monthExpense;

  // Streak & completion stats
  const completedToday = new Set(
    completions.filter((c) => c.completed_on === today).map((c) => c.routine_id),
  );
  const byRoutine: Record<string, Set<string>> = {};
  for (const c of completions) {
    if (!byRoutine[c.routine_id]) byRoutine[c.routine_id] = new Set();
    byRoutine[c.routine_id].add(c.completed_on);
  }
  const streaks: Record<string, number> = {};
  for (const [rid, dates] of Object.entries(byRoutine)) {
    streaks[rid] = computeStreak(dates, today);
  }

  const totalHabits = routine.length;
  const doneCount = routine.filter((r) => completedToday.has(r.id)).length;

  const topStreaks = routine
    .map((r) => ({ title: r.title, emoji: r.emoji, streak: streaks[r.id] ?? 0 }))
    .filter((r) => r.streak > 0)
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 3);

  // Consistency score: completions in last 30 days / (30 × habits)
  const since30 = addDaysISO(today, -30);
  const last30 = completions.filter((c) => c.completed_on >= since30);
  const consistencyScore = totalHabits > 0
    ? Math.min(100, Math.round((last30.length / (30 * totalHabits)) * 100))
    : 0;

  return (
    <>
      <GradientHeader
        emoji={greetingEmoji()}
        title={`${greetingForHour()}, ${displayName(user?.email ?? "")}`}
        subtitle={formatDateBRT(new Date())}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Rotina + Streak */}
        <GlassCard>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">📅 Rotina de hoje</h2>
            {totalHabits > 0 ? (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{
                  background: doneCount === totalHabits ? "var(--color-success)" : "var(--color-card)",
                  color: doneCount === totalHabits ? "white" : "var(--color-fg-muted)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {doneCount}/{totalHabits}
              </span>
            ) : null}
          </div>

          {routine.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Nenhum bloco cadastrado.{" "}
              <Link className="underline" href="/rotina">
                Criar
              </Link>
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {routine.slice(0, 6).map((r) => {
                const done = completedToday.has(r.id);
                const streak = streaks[r.id] ?? 0;
                return (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span style={{ textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1 }}>
                      {done ? "✅" : "⬜"}{" "}
                      {r.emoji ? <span className="mr-1">{r.emoji}</span> : null}
                      {r.title}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {streak > 0 ? (
                        <span className="text-xs font-semibold">🔥 {streak}</span>
                      ) : null}
                      <span className="font-mono text-xs" style={{ color: "var(--color-fg-subtle)" }}>
                        {r.time_slot.slice(0, 5)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {totalHabits > 0 ? (
            <div className="mt-3 border-t pt-2" style={{ borderColor: "var(--color-border)" }}>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-medium" style={{ color: "var(--color-fg-muted)" }}>
                  Consistência (30 dias)
                </p>
                <span className="text-xs font-semibold" style={{ color: consistencyScore >= 70 ? "var(--color-success)" : consistencyScore >= 40 ? "var(--color-accent)" : "var(--color-danger)" }}>
                  {consistencyScore}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--color-border)" }}>
                <div className="h-full rounded-full transition-all" style={{
                  width: `${consistencyScore}%`,
                  background: consistencyScore >= 70 ? "var(--color-success)" : consistencyScore >= 40 ? "var(--color-accent)" : "var(--color-danger)",
                }} />
              </div>
            </div>
          ) : null}

          {topStreaks.length > 0 ? (
            <div className="mt-3 border-t pt-2" style={{ borderColor: "var(--color-border)" }}>
              <p className="mb-1 text-xs font-medium" style={{ color: "var(--color-fg-muted)" }}>
                🏆 Maiores sequências
              </p>
              <div className="flex flex-wrap gap-2">
                {topStreaks.map((s) => {
                  const badge = s.streak >= 100 ? "🥇" : s.streak >= 30 ? "🥈" : s.streak >= 7 ? "🥉" : null;
                  return (
                    <span key={s.title} className="rounded-full px-2 py-0.5 text-xs"
                      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
                      {s.emoji ?? "🔥"} {s.title} · {s.streak}d{badge ? ` ${badge}` : ""}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}

          <Link
            href="/rotina"
            className="mt-4 block text-right text-xs font-medium"
            style={{ color: "var(--color-accent)" }}
          >
            marcar hábitos →
          </Link>
        </GlassCard>

        <GlassCard>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">🎯 Metas ativas</h2>
          {goals.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Nenhuma meta ativa.{" "}
              <Link className="underline" href="/metas">
                Criar
              </Link>
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {goals.slice(0, 5).map((g) => (
                <li key={g.id}>→ {g.title}</li>
              ))}
            </ul>
          )}
          <Link
            href="/metas"
            className="mt-4 block text-right text-xs font-medium"
            style={{ color: "var(--color-accent)" }}
          >
            ver todas →
          </Link>
        </GlassCard>

        <GlassCard>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">✅ Próximas tarefas</h2>
          {tasks.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Nenhuma tarefa pendente.{" "}
              <Link className="underline" href="/metas">
                Criar
              </Link>
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <span>○ {t.title}</span>
                  {t.due_date ? (
                    <span className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>
                      {t.due_date}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">💰 Mês corrente</h2>
          {txs.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Nenhum lançamento.{" "}
              <Link className="underline" href="/financas">
                Lançar
              </Link>
            </p>
          ) : (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span style={{ color: "var(--color-fg-muted)" }}>Receitas</span>
                <span className="font-mono" style={{ color: "var(--color-success)" }}>
                  {formatBRL(monthIncome)}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--color-fg-muted)" }}>Despesas</span>
                <span className="font-mono" style={{ color: "var(--color-danger)" }}>
                  {formatBRL(monthExpense)}
                </span>
              </div>
              <div
                className="mt-2 flex justify-between border-t pt-2"
                style={{ borderColor: "var(--color-border)" }}
              >
                <span className="font-semibold">Saldo</span>
                <span
                  className="font-mono font-semibold"
                  style={{
                    color: monthNet >= 0 ? "var(--color-success)" : "var(--color-danger)",
                  }}
                >
                  {formatBRL(monthNet)}
                </span>
              </div>
            </div>
          )}
          <Link
            href="/financas?t=graficos"
            className="mt-3 block text-right text-xs font-medium"
            style={{ color: "var(--color-accent)" }}
          >
            ver gráficos →
          </Link>
          <p
            className="mt-3 border-t pt-2 text-[10px] italic"
            style={{ borderColor: "var(--color-border)", color: "var(--color-fg-subtle)" }}
          >
            "A maneira mais confiável de prever o futuro é criá-lo." —{" "}
            {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][weekday]}
          </p>
        </GlassCard>
      </div>
    </>
  );
}

function computeStreak(dates: Set<string>, today: string): number {
  let current = today;
  let streak = 0;
  if (!dates.has(current)) current = addDaysISO(current, -1);
  while (dates.has(current)) {
    streak++;
    current = addDaysISO(current, -1);
  }
  return streak;
}

function greetingEmoji() {
  const h = new Date().getHours();
  if (h < 6) return "🌙";
  if (h < 12) return "☀️";
  if (h < 18) return "⛅";
  return "🌆";
}

function displayName(email: string): string {
  return email.split("@")[0] ?? "você";
}
