import Link from "next/link";
import { GlassCard } from "@/components/glass/GlassCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { addDaysISO, todayBRTISO } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import { DailyForm } from "./DailyForm";
import { DailyList } from "./DailyList";
import { WeeklyGrid } from "./WeeklyGrid";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ tab?: "diaria" | "semanal" }>;

export default async function RotinaPage({ searchParams }: { searchParams: SearchParams }) {
  const { tab = "diaria" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user!.id;
  const today = todayBRTISO();
  const since90 = addDaysISO(today, -90);

  const [daily, weekly, completionsRes] = await Promise.all([
    supabase
      .from("routine_daily")
      .select("*")
      .eq("user_id", userId)
      .order("time_slot", { ascending: true }),
    supabase
      .from("routine_weekly")
      .select("*")
      .eq("user_id", userId)
      .order("weekday", { ascending: true }),
    supabase
      .from("routine_completions")
      .select("routine_id, completed_on")
      .eq("user_id", userId)
      .gte("completed_on", since90)
      .order("completed_on", { ascending: false }),
  ]);

  const completions = completionsRes.data ?? [];
  const completedToday = new Set(
    completions.filter((c) => c.completed_on === today).map((c) => c.routine_id),
  );

  // Group by routine_id for streak calculation
  const byRoutine: Record<string, Set<string>> = {};
  for (const c of completions) {
    if (!byRoutine[c.routine_id]) byRoutine[c.routine_id] = new Set();
    byRoutine[c.routine_id].add(c.completed_on);
  }

  const streaks: Record<string, number> = {};
  for (const [routineId, dates] of Object.entries(byRoutine)) {
    streaks[routineId] = computeStreak(dates, today);
  }

  return (
    <>
      <GradientHeader emoji="📅" title="Rotina" subtitle="Como o seu dia e semana devem fluir." />

      <div className="mb-4 inline-flex gap-1 rounded-lg p-1" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
        <TabLink href="/rotina?tab=diaria" active={tab === "diaria"} label="Diária" />
        <TabLink href="/rotina?tab=semanal" active={tab === "semanal"} label="Semanal" />
      </div>

      {tab === "diaria" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <GlassCard>
            <h2 className="mb-3 font-semibold">Blocos do dia</h2>
            <DailyList
              blocks={daily.data ?? []}
              completedToday={[...completedToday]}
              streaks={streaks}
              todayISO={today}
            />
          </GlassCard>
          <GlassCard>
            <h2 className="mb-3 font-semibold">Novo bloco</h2>
            <DailyForm />
          </GlassCard>
        </div>
      ) : (
        <WeeklyGrid blocks={weekly.data ?? []} />
      )}
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

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-md gradient-brand px-3 py-1.5 text-sm font-semibold text-white"
          : "rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-80"
      }
    >
      {label}
    </Link>
  );
}
