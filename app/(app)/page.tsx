import { AnimatedCounter } from "@/components/AnimatedCounter";
import { Col, Grid } from "@/components/grid/Grid";
import { addDaysISO, todayBRTISO } from "@/lib/datetime";
import { getUserClaims } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { ReactNode } from "react";
import { FinanceCard } from "./_dashboard/FinanceCard";
import { GoalsCard } from "./_dashboard/GoalsCard";
import { Hero } from "./_dashboard/Hero";
import { RoutineCard, type TopStreak } from "./_dashboard/RoutineCard";
import { TasksCard } from "./_dashboard/TasksCard";
import { Ticker } from "./_dashboard/Ticker";
import { computeStreak, scoreColor } from "./_dashboard/shared";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const claims = await getUserClaims();
  const userId = claims!.sub;

  const today = todayBRTISO();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const since90 = addDaysISO(today, -90);

  const [dailyRes, goalsRes, tasksRes, txRes, completionsRes, profileRes] = await Promise.all([
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
    supabase.from("profiles").select("display_name, full_name").eq("id", userId).maybeSingle(),
  ]);

  const routine = dailyRes.data ?? [];
  const goals = goalsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const txs = txRes.data ?? [];
  const completions = completionsRes.data ?? [];
  const profile = profileRes.data;

  // Hero name: nickname > full name > email handle.
  const heroName =
    profile?.display_name?.trim() || profile?.full_name?.trim() || displayName(claims?.email ?? "");

  const monthIncome = txs.reduce((s, t) => (t.kind === "income" ? s + t.amount_cents : s), 0);
  const monthExpense = txs.reduce((s, t) => (t.kind === "expense" ? s + t.amount_cents : s), 0);
  const monthNet = monthIncome - monthExpense;

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
  const allDone = totalHabits > 0 && doneCount === totalHabits;

  const topStreaks: TopStreak[] = routine
    .map((r) => ({ title: r.title, emoji: r.emoji, streak: streaks[r.id] ?? 0 }))
    .filter((r) => r.streak > 0)
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 3);

  // Consistency: completions in last 30 days / (30 × habits)
  const since30 = addDaysISO(today, -30);
  const last30 = completions.filter((c) => c.completed_on >= since30);
  const consistencyScore =
    totalHabits > 0 ? Math.min(100, Math.round((last30.length / (30 * totalHabits)) * 100)) : 0;
  const consistencyColor = scoreColor(consistencyScore);

  const stats: { label: string; node: ReactNode; color: string }[] = [
    {
      label: "Hábitos hoje",
      node:
        totalHabits > 0 ? (
          <AnimatedCounter to={doneCount} suffix={`/${totalHabits}`} delay={100} />
        ) : (
          "—"
        ),
      color: "var(--color-fg)",
    },
    {
      label: "Consistência",
      node: <AnimatedCounter to={consistencyScore} suffix="%" delay={240} />,
      color: consistencyColor,
    },
    {
      label: "Saldo do mês",
      node: <AnimatedCounter to={monthNet} currency delay={380} />,
      color: monthNet >= 0 ? "var(--color-success)" : "var(--color-danger)",
    },
  ];

  return (
    <>
      <Hero heroName={heroName} stats={stats} now={now} />
      <Ticker />
      <Grid>
        <Col span={7} spanSm={6} reveal>
          <RoutineCard
            routine={routine}
            completedToday={completedToday}
            streaks={streaks}
            topStreaks={topStreaks}
            consistencyScore={consistencyScore}
            consistencyColor={consistencyColor}
            doneCount={doneCount}
            totalHabits={totalHabits}
            allDone={allDone}
          />
        </Col>
        <Col span={5} spanSm={3} reveal delay={80}>
          <GoalsCard goals={goals} />
        </Col>
        <Col span={5} spanSm={3} reveal delay={160}>
          <TasksCard tasks={tasks} />
        </Col>
        <Col span={7} spanSm={6} reveal delay={240}>
          <FinanceCard
            hasTransactions={txs.length > 0}
            monthIncome={monthIncome}
            monthExpense={monthExpense}
            monthNet={monthNet}
          />
        </Col>
      </Grid>
    </>
  );
}

function displayName(email: string): string {
  return email.split("@")[0] ?? "você";
}
