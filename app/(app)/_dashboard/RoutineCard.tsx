import { CardHead } from "@/components/glass/CardHead";
import { FoldCard } from "@/components/glass/FoldCard";
import { CalendarDays, CheckCircle2, Circle, Flame, Trophy } from "lucide-react";
import { CardLink, EmptyState } from "./shared";

export type RoutineRow = {
  id: string;
  time_slot: string;
  title: string;
  emoji: string | null;
};

export type TopStreak = { title: string; emoji: string | null; streak: number };

export function RoutineCard({
  routine,
  completedToday,
  streaks,
  topStreaks,
  consistencyScore,
  consistencyColor,
  doneCount,
  totalHabits,
  allDone,
}: {
  routine: RoutineRow[];
  completedToday: Set<string>;
  streaks: Record<string, number>;
  topStreaks: TopStreak[];
  consistencyScore: number;
  consistencyColor: string;
  doneCount: number;
  totalHabits: number;
  allDone: boolean;
}) {
  return (
    <FoldCard index={1}>
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
                  <span className={done ? "truncate line-through" : "truncate"}>{r.title}</span>
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
        <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
          <div className="mb-1.5 flex items-center justify-between">
            <p
              className="text-eyebrow font-semibold uppercase tracking-[0.1em]"
              style={{ color: "var(--color-fg-subtle)" }}
            >
              Consistência · 30 dias
            </p>
            <span className="font-mono text-xs font-semibold" style={{ color: consistencyColor }}>
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
  );
}
