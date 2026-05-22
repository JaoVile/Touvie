import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Flame,
  ListChecks,
  Target,
  Trophy,
  Wallet,
} from "lucide-react";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { CircleText } from "@/components/CircleText";
import { Magnetic } from "@/components/Magnetic";
import { Marquee } from "@/components/Marquee";
import { Parallax } from "@/components/Parallax";
import { Reveal } from "@/components/Reveal";
import { ScrollFade } from "@/components/ScrollFade";
import { CardHead } from "@/components/glass/CardHead";
import { FoldCard } from "@/components/glass/FoldCard";
import { Col, Grid } from "@/components/grid/Grid";
import { addDaysISO, formatDateBRT, greetingForHour, todayBRTISO } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

/* Faint editorial glyphs drifting behind the dashboard, each at its
   own scroll rhythm. Tune size / position / opacity / speed here. */
const PARALLAX_GLYPHS = [
  { char: "✦", size: "18rem", top: "20%", left: "6%", speed: -0.18, opacity: 0.05, color: "var(--color-accent)" },
  { char: "♪", size: "12rem", top: "54%", left: "80%", speed: -0.34, opacity: 0.05, color: "var(--color-fg)" },
  { char: "♫", size: "15rem", top: "82%", left: "36%", speed: -0.09, opacity: 0.04, color: "var(--color-accent)" },
] as const;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

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
    supabase
      .from("profiles")
      .select("display_name, full_name")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const routine = dailyRes.data ?? [];
  const goals = goalsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const txs = txRes.data ?? [];
  const completions = completionsRes.data ?? [];
  const profile = profileRes.data;

  // Hero name: the chosen nickname wins, then full name, then the
  // email handle as a last resort.
  const heroName =
    profile?.display_name?.trim() ||
    profile?.full_name?.trim() ||
    displayName(user?.email ?? "");

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
  const allDone = totalHabits > 0 && doneCount === totalHabits;

  const topStreaks = routine
    .map((r) => ({ title: r.title, emoji: r.emoji, streak: streaks[r.id] ?? 0 }))
    .filter((r) => r.streak > 0)
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 3);

  // Consistency score: completions in last 30 days / (30 × habits)
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
      {/* ── Parallax depth layer — faint glyphs drifting on scroll ── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        {PARALLAX_GLYPHS.map((g) => (
          <Parallax
            key={g.char}
            speed={g.speed}
            className="absolute"
            style={{ top: g.top, left: g.left }}
          >
            <span
              className="block select-none leading-none"
              style={{ fontSize: g.size, color: g.color, opacity: g.opacity }}
            >
              {g.char}
            </span>
          </Parallax>
        ))}
      </div>

      {/* ── Hero — recedes on scroll, handing off to the cards ── */}
      <ScrollFade>
        <Reveal>
          <header className="mb-9 flex flex-col items-center text-center">
            <div className="flex items-center gap-2">
              <span className="float-note text-lg" style={{ color: "var(--color-accent)" }}>
                ♪
              </span>
              <span
                className="text-eyebrow font-bold uppercase tracking-[0.32em]"
                style={{ color: "var(--color-fg-subtle)" }}
              >
                Touvie
              </span>
            </div>

            {/* Greeting arc hugging the name's upper-left — asymmetric,
                editorial. The big name is pulled up into the arc's curve.
                Tune together: radius (arc size), startOffset (where the
                phrase sits on the arc), the -mt overlap, and the name size. */}
            <div className="mt-8 flex flex-col items-center">
              <CircleText
                text={`· ${greetingForHour().toUpperCase()} ·`}
                radius={115}
                arc="top"
                startOffset={0.06}
                fontSize={13}
                letterSpacing="0.44em"
                style={{
                  color: "var(--color-accent)",
                  // rotate the arc 11° clockwise and lift it a touch
                  transform: "translateY(-1.5rem) rotate(11deg)",
                }}
              />
              <h1 className="display -mt-[7rem] text-[3.25rem] leading-[1.05] sm:text-[4.75rem]">
                <span className="display-i gradient-text-anim">{heroName}</span>
              </h1>
            </div>

            {/* Date framed by a pair of hairlines. */}
            <div className="mt-3 flex items-center gap-3">
              <span className="h-px w-10" style={{ background: "var(--color-border)" }} />
              <p
                className="text-sm first-letter:uppercase"
                style={{ color: "var(--color-fg-muted)" }}
              >
                {formatDateBRT(now)}
              </p>
              <span className="h-px w-10" style={{ background: "var(--color-border)" }} />
            </div>

            {/* Stat strip */}
            <dl className="glass mt-6 flex w-full overflow-hidden">
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  className="flex-1 px-4 py-3.5 sm:px-6"
                  style={i > 0 ? { borderLeft: "1px solid var(--color-border)" } : undefined}
                >
                  <dt
                    className="text-eyebrow font-semibold uppercase tracking-[0.13em]"
                    style={{ color: "var(--color-fg-subtle)" }}
                  >
                    {s.label}
                  </dt>
                  <dd
                    className="mt-1 font-mono text-lg font-semibold leading-none sm:text-xl"
                    style={{ color: s.color }}
                  >
                    {s.node}
                  </dd>
                </div>
              ))}
            </dl>
          </header>
        </Reveal>
      </ScrollFade>

      {/* ── Editorial ticker — silent rhythm between hero and cards ── */}
      <div
        className="mb-6 border-y py-3"
        style={{ borderColor: "var(--color-border)" }}
      >
        <Marquee
          duration={48}
          gap="2.5rem"
          className="eyebrow"
          style={{ color: "var(--color-accent)", "--marquee-fade": "48px" } as React.CSSProperties}
        >
          {[
            "Touvie",
            "Rotina",
            "Metas",
            "Tarefas",
            "Finanças",
            "Hábitos",
            "Diário",
            "Editorial · 2026",
          ].map((label) => (
            <span key={label}>
              <span style={{ opacity: 0.5 }}>✦</span>&nbsp;&nbsp;{label}
            </span>
          ))}
        </Marquee>
      </div>

      {/* ── Cards — editorial 12-col grid, mirrored 7/5 asymmetry ── */}
      <Grid>
        {/* Rotina + streaks */}
        <Col span={7} spanSm={6} reveal>
          <FoldCard>
            <CardHead
              icon={CalendarDays}
              title="Rotina de hoje"
              badge={
                totalHabits > 0 ? (
                  <span
                    className="rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold"
                    style={{
                      background: allDone ? "var(--color-success)" : "var(--color-card)",
                      color: allDone ? "#fff" : "var(--color-fg-muted)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {doneCount}/{totalHabits}
                  </span>
                ) : undefined
              }
            />

            {routine.length === 0 ? (
              <EmptyState href="/rotina" label="Criar bloco">
                Nenhum bloco de rotina cadastrado.
              </EmptyState>
            ) : (
              <ul className="space-y-2.5">
                {routine.slice(0, 6).map((r) => {
                  const done = completedToday.has(r.id);
                  const streak = streaks[r.id] ?? 0;
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                      <span
                        className="flex min-w-0 items-center gap-2"
                        style={{ opacity: done ? 0.5 : 1 }}
                      >
                        {done ? (
                          <CheckCircle2
                            size={15}
                            strokeWidth={1.75}
                            style={{ color: "var(--color-success)" }}
                          />
                        ) : (
                          <Circle
                            size={15}
                            strokeWidth={1.75}
                            style={{ color: "var(--color-fg-subtle)" }}
                          />
                        )}
                        {r.emoji ? <span>{r.emoji}</span> : null}
                        <span className={done ? "truncate line-through" : "truncate"}>
                          {r.title}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {streak > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                            style={{ background: "var(--color-card)" }}
                          >
                            <Flame size={11} strokeWidth={2} style={{ color: "var(--color-accent)" }} />
                            {streak}
                          </span>
                        ) : null}
                        <span
                          className="font-mono text-xs"
                          style={{ color: "var(--color-fg-subtle)" }}
                        >
                          {r.time_slot.slice(0, 5)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {totalHabits > 0 ? (
              <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
                <div className="mb-1.5 flex items-center justify-between">
                  <p
                    className="text-eyebrow font-semibold uppercase tracking-[0.1em]"
                    style={{ color: "var(--color-fg-subtle)" }}
                  >
                    Consistência · 30 dias
                  </p>
                  <span
                    className="font-mono text-xs font-semibold"
                    style={{ color: consistencyColor }}
                  >
                    {consistencyScore}%
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full"
                  style={{ background: "var(--color-border)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${consistencyScore}%`, background: consistencyColor }}
                  />
                </div>
              </div>
            ) : null}

            {topStreaks.length > 0 ? (
              <div className="mt-3.5">
                <p
                  className="mb-1.5 flex items-center gap-1.5 text-eyebrow font-semibold uppercase tracking-[0.1em]"
                  style={{ color: "var(--color-fg-subtle)" }}
                >
                  <Trophy size={12} strokeWidth={1.75} style={{ color: "var(--color-accent)" }} />
                  Maiores sequências
                </p>
                <div className="flex flex-wrap gap-2">
                  {topStreaks.map((s) => {
                    const badge =
                      s.streak >= 100 ? "🥇" : s.streak >= 30 ? "🥈" : s.streak >= 7 ? "🥉" : null;
                    return (
                      <span
                        key={s.title}
                        className="rounded-full px-2.5 py-1 text-xs"
                        style={{
                          background: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        {s.emoji ?? "🔥"} {s.title} ·{" "}
                        <span className="font-mono font-semibold">{s.streak}d</span>
                        {badge ? ` ${badge}` : ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <CardLink href="/rotina">Marcar hábitos</CardLink>
          </FoldCard>
        </Col>

        {/* Metas */}
        <Col span={5} spanSm={3} reveal delay={80}>
          <FoldCard>
            <CardHead icon={Target} title="Metas ativas" />
            {goals.length === 0 ? (
              <div className="flex flex-col items-center pb-1 pt-2 text-center">
                <CircleText
                  text="FAÇA UMA META · COMECE HOJE"
                  radius={80}
                  arc="top"
                  fontSize={11}
                  letterSpacing="0.4em"
                  style={{ color: "var(--color-accent)" }}
                />
                <div className="-mt-2">
                  <EmptyState href="/metas" label="Criar meta">
                    Nenhuma meta ativa.
                  </EmptyState>
                </div>
              </div>
            ) : (
              <ul className="space-y-2.5 text-sm">
                {goals.slice(0, 5).map((g) => (
                  <li key={g.id} className="flex items-center gap-2">
                    <span style={{ color: "var(--color-accent)" }}>→</span>
                    <span className="truncate">{g.title}</span>
                  </li>
                ))}
              </ul>
            )}
            <CardLink href="/metas">Ver todas</CardLink>
          </FoldCard>
        </Col>

        {/* Tarefas */}
        <Col span={5} spanSm={3} reveal delay={160}>
          <FoldCard>
            <CardHead icon={ListChecks} title="Próximas tarefas" />
            {tasks.length === 0 ? (
              <EmptyState href="/metas" label="Criar tarefa">
                Nenhuma tarefa pendente.
              </EmptyState>
            ) : (
              <ul className="space-y-2.5 text-sm">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span style={{ color: "var(--color-fg-subtle)" }}>○</span>
                      <span className="truncate">{t.title}</span>
                    </span>
                    {t.due_date ? (
                      <span
                        className="shrink-0 font-mono text-xs"
                        style={{ color: "var(--color-fg-subtle)" }}
                      >
                        {t.due_date.slice(5)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <CardLink href="/metas">Gerenciar</CardLink>
          </FoldCard>
        </Col>

        {/* Finanças */}
        <Col span={7} spanSm={6} reveal delay={240}>
          <FoldCard>
            <CardHead icon={Wallet} title="Mês corrente" />
            {txs.length === 0 ? (
              <EmptyState href="/financas" label="Lançar">
                Nenhum lançamento neste mês.
              </EmptyState>
            ) : (
              <div className="space-y-2 text-sm">
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
                  className="flex justify-between border-t pt-2"
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

            <div className="mt-auto">
              <CardLink href="/financas?t=graficos">Ver gráficos</CardLink>
              <p
                className="mt-3 border-t pt-3 text-[0.7rem] italic"
                style={{ borderColor: "var(--color-border)", color: "var(--color-fg-subtle)" }}
              >
                "A maneira mais confiável de prever o futuro é criá-lo."
              </p>
            </div>
          </FoldCard>
        </Col>
      </Grid>
    </>
  );
}

/* ── Local presentation helpers ─────────────────────────────── */

function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <div className="mt-auto flex justify-end pt-4">
      <Magnetic strength={0.35} radius={70}>
        <Link
          href={href}
          className="group/lnk flex items-center gap-1 text-eyebrow font-semibold uppercase tracking-[0.1em] transition-colors"
          style={{ color: "var(--color-accent)" }}
        >
          <span className="link-underline">{children}</span>
          <span className="transition-transform group-hover/lnk:translate-x-0.5">→</span>
        </Link>
      </Magnetic>
    </div>
  );
}

function EmptyState({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
      {children}{" "}
      <Link
        className="link-underline font-medium"
        href={href}
        style={{ color: "var(--color-accent)" }}
      >
        {label}
      </Link>
    </p>
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

function scoreColor(score: number): string {
  if (score >= 70) return "var(--color-success)";
  if (score >= 40) return "var(--color-accent)";
  return "var(--color-danger)";
}

function displayName(email: string): string {
  return email.split("@")[0] ?? "você";
}
