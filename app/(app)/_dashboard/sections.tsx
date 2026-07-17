import { AnimatedCounter } from "@/components/AnimatedCounter";
import { Col } from "@/components/grid/Grid";
import { getUserClaims } from "@/lib/supabase/auth";
import type { ReactNode } from "react";
import { FinanceCard } from "./FinanceCard";
import { GoalsCard } from "./GoalsCard";
import { Hero } from "./Hero";
import { RoutineCard } from "./RoutineCard";
import { TasksCard } from "./TasksCard";
import { getFinanceStats, getGoals, getProfile, getRoutineStats, getTasks } from "./data";

/**
 * Seções assíncronas do dashboard — cada uma faz suas próprias consultas
 * (dedup via `React.cache()` em `data.ts`) e é montada dentro de um <Suspense>
 * no page, então pinta assim que SEUS dados resolvem, sem esperar as demais.
 */

/**
 * O Hero mostra agregados (hábitos hoje, consistência, saldo do mês) que
 * dependem de rotina + completions + transações. Por isso ele espera esses
 * dados — mas parte dos MESMOS agregados cacheados que alimentam o RoutineCard
 * e o FinanceCard, garantindo números idênticos.
 */
export async function HeroSection() {
  const [routineStats, finance, profile, claims] = await Promise.all([
    getRoutineStats(),
    getFinanceStats(),
    getProfile(),
    getUserClaims(),
  ]);

  const { totalHabits, doneCount, consistencyScore, consistencyColor } = routineStats;
  const { monthNet } = finance;

  const heroName =
    profile?.display_name?.trim() || profile?.full_name?.trim() || displayName(claims?.email ?? "");

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

  return <Hero heroName={heroName} stats={stats} now={new Date()} />;
}

export async function RoutineSection() {
  const stats = await getRoutineStats();
  return (
    <Col span={7} spanSm={6} reveal>
      <RoutineCard
        routine={stats.routine}
        completedToday={stats.completedToday}
        streaks={stats.streaks}
        topStreaks={stats.topStreaks}
        consistencyScore={stats.consistencyScore}
        consistencyColor={stats.consistencyColor}
        doneCount={stats.doneCount}
        totalHabits={stats.totalHabits}
        allDone={stats.allDone}
      />
    </Col>
  );
}

export async function GoalsSection() {
  const goals = await getGoals();
  return (
    <Col span={5} spanSm={3} reveal delay={80}>
      <GoalsCard goals={goals} />
    </Col>
  );
}

export async function TasksSection() {
  const tasks = await getTasks();
  return (
    <Col span={5} spanSm={3} reveal delay={160}>
      <TasksCard tasks={tasks} />
    </Col>
  );
}

export async function FinanceSection() {
  const finance = await getFinanceStats();
  return (
    <Col span={7} spanSm={6} reveal delay={240}>
      <FinanceCard
        hasTransactions={finance.hasTransactions}
        monthIncome={finance.monthIncome}
        monthExpense={finance.monthExpense}
        monthNet={finance.monthNet}
      />
    </Col>
  );
}

function displayName(email: string): string {
  return email.split("@")[0] ?? "você";
}
