import { CalendarDays, CalendarPlus, CalendarRange, LayoutList, Sun, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { CardHead } from "@/components/glass/CardHead";
import { FoldCard } from "@/components/glass/FoldCard";
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
      <PageGlyphs variant="routine" />

      <Reveal>
        <GradientHeader
          icon={CalendarDays}
          eyebrow="Ritmo · Semana"
          title="Rotina"
          subtitle="Como o seu dia e semana devem fluir."
        />
      </Reveal>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b" style={{ borderColor: "var(--color-border)" }}>
        <TabLink href="/rotina?tab=diaria" active={tab === "diaria"} label="Diária" icon={Sun} />
        <TabLink href="/rotina?tab=semanal" active={tab === "semanal"} label="Semanal" icon={CalendarRange} />
      </div>

      {tab === "diaria" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Reveal className="h-full">
            <FoldCard>
              <CardHead icon={LayoutList} title="Blocos do dia" />
              <DailyList
                blocks={daily.data ?? []}
                completedToday={[...completedToday]}
                streaks={streaks}
                todayISO={today}
              />
            </FoldCard>
          </Reveal>
          <Reveal className="h-full" delay={80}>
            <FoldCard>
              <CardHead icon={CalendarPlus} title="Novo bloco" />
              <DailyForm />
            </FoldCard>
          </Reveal>
        </div>
      ) : (
        <Reveal>
          <WeeklyGrid blocks={weekly.data ?? []} />
        </Reveal>
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

function TabLink({
  href,
  active,
  label,
  icon: Icon,
}: { href: string; active: boolean; label: string; icon: LucideIcon }) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-eyebrow font-semibold uppercase tracking-[0.1em] transition-colors"
      style={{ color: active ? "var(--color-accent)" : "var(--color-fg-subtle)" }}
    >
      <Icon size={14} strokeWidth={1.75} />
      {label}
      {active ? (
        <span
          className="absolute inset-x-0 -bottom-px h-0.5"
          style={{
            background:
              "linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 8%, transparent) 92%)",
          }}
        />
      ) : null}
    </Link>
  );
}
