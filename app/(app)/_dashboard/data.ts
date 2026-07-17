import { addDaysISO, todayBRTISO } from "@/lib/datetime";
import { getUserClaims } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { cache } from "react";
import type { Goal } from "./GoalsCard";
import type { RoutineRow, TopStreak } from "./RoutineCard";
import type { Task } from "./TasksCard";
import { computeStreak, scoreColor } from "./shared";

/**
 * Consultas do dashboard, cada uma embrulhada em `React.cache()` — o Hero e os
 * cards de seção streamam em <Suspense> separados, então mais de um componente
 * pode pedir a MESMA query no mesmo request (ex.: rotina + completions servem o
 * Hero E o RoutineCard). O `cache()` garante que cada query roda UMA vez e todos
 * recebem a mesma linha — sem waterfall e com números idênticos entre seções.
 */

const requireUserId = cache(async (): Promise<string> => {
  const claims = await getUserClaims();
  return claims!.sub;
});

const getRoutine = cache(async (): Promise<RoutineRow[]> => {
  const supabase = await createClient();
  const userId = await requireUserId();
  const { data } = await supabase
    .from("routine_daily")
    .select("id, time_slot, title, emoji")
    .eq("user_id", userId)
    .eq("active", true)
    .order("time_slot", { ascending: true });
  return data ?? [];
});

const getCompletions = cache(async (): Promise<{ routine_id: string; completed_on: string }[]> => {
  const supabase = await createClient();
  const userId = await requireUserId();
  const since90 = addDaysISO(todayBRTISO(), -90);
  const { data } = await supabase
    .from("routine_completions")
    .select("routine_id, completed_on")
    .eq("user_id", userId)
    .gte("completed_on", since90)
    .order("completed_on", { ascending: false });
  return data ?? [];
});

const getTransactions = cache(async (): Promise<{ amount_cents: number; kind: string }[]> => {
  const supabase = await createClient();
  const userId = await requireUserId();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("transactions")
    .select("amount_cents, kind")
    .eq("user_id", userId)
    .eq("is_recurring", false)
    .gte("occurred_on", monthStart)
    .lte("occurred_on", monthEnd);
  return data ?? [];
});

export const getGoals = cache(async (): Promise<Goal[]> => {
  const supabase = await createClient();
  const userId = await requireUserId();
  const { data } = await supabase
    .from("goals")
    .select("id, title")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("sort_order");
  return data ?? [];
});

export const getTasks = cache(async (): Promise<Task[]> => {
  const supabase = await createClient();
  const userId = await requireUserId();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, done, due_date")
    .eq("user_id", userId)
    .eq("done", false)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(6);
  return data ?? [];
});

export const getProfile = cache(
  async (): Promise<{ display_name: string | null; full_name: string | null } | null> => {
    const supabase = await createClient();
    const userId = await requireUserId();
    const { data } = await supabase
      .from("profiles")
      .select("display_name, full_name")
      .eq("id", userId)
      .maybeSingle();
    return data;
  },
);

export type RoutineStats = {
  routine: RoutineRow[];
  completedToday: Set<string>;
  streaks: Record<string, number>;
  topStreaks: TopStreak[];
  consistencyScore: number;
  consistencyColor: string;
  doneCount: number;
  totalHabits: number;
  allDone: boolean;
};

/**
 * Agregados de rotina — derivados de rotina + completions. Cacheado pra que o
 * Hero (que só precisa de doneCount/consistência) e o RoutineCard partam
 * EXATAMENTE dos mesmos números, sem recomputar streak/consistência.
 */
export const getRoutineStats = cache(async (): Promise<RoutineStats> => {
  const [routine, completions] = await Promise.all([getRoutine(), getCompletions()]);
  const today = todayBRTISO();

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

  // Consistência: completions nos últimos 30 dias / (30 × hábitos)
  const since30 = addDaysISO(today, -30);
  const last30 = completions.filter((c) => c.completed_on >= since30);
  const consistencyScore =
    totalHabits > 0 ? Math.min(100, Math.round((last30.length / (30 * totalHabits)) * 100)) : 0;

  return {
    routine,
    completedToday,
    streaks,
    topStreaks,
    consistencyScore,
    consistencyColor: scoreColor(consistencyScore),
    doneCount,
    totalHabits,
    allDone,
  };
});

export type FinanceStats = {
  hasTransactions: boolean;
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
};

/** Agregados do mês corrente — derivados das transações. */
export const getFinanceStats = cache(async (): Promise<FinanceStats> => {
  const txs = await getTransactions();
  const monthIncome = txs.reduce((s, t) => (t.kind === "income" ? s + t.amount_cents : s), 0);
  const monthExpense = txs.reduce((s, t) => (t.kind === "expense" ? s + t.amount_cents : s), 0);
  return {
    hasTransactions: txs.length > 0,
    monthIncome,
    monthExpense,
    monthNet: monthIncome - monthExpense,
  };
});
