import { GlassCard } from "@/components/glass/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { estimate1RM } from "@/lib/workout";
import { ProgressionChart } from "./ProgressionChart";

interface Props {
  userId: string;
}

export async function PRsTab({ userId }: Props) {
  const supabase = await createClient();

  // PRs vindo da view
  const { data: prs } = await supabase
    .from("personal_records")
    .select(
      "exercise_id, exercise_name, muscle_group, best_1rm, best_weight, total_sets, last_logged_on",
    )
    .eq("user_id", userId)
    .order("best_1rm", { ascending: false });

  const prRows = (prs ?? []) as Array<{
    exercise_id: string;
    exercise_name: string;
    muscle_group: string | null;
    best_1rm: number;
    best_weight: number;
    total_sets: number;
    last_logged_on: string;
  }>;

  if (prRows.length === 0) {
    return (
      <GlassCard>
        <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
          Sem dados ainda. Logue séries com peso e reps na aba <strong>Hoje</strong> e os recordes
          aparecem aqui.
        </p>
      </GlassCard>
    );
  }

  // Sessões dos últimos 90 dias → dá o occurred_on
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffISO = cutoff.toISOString().slice(0, 10);

  const { data: recentSessions } = await supabase
    .from("workout_sessions")
    .select("id, occurred_on")
    .eq("user_id", userId)
    .gte("occurred_on", cutoffISO);

  const sessionDateMap = new Map(
    (recentSessions ?? []).map((s) => [s.id, s.occurred_on as string]),
  );
  const recentSessionIds = Array.from(sessionDateMap.keys());

  const exerciseIds = prRows.map((r) => r.exercise_id);
  const { data: progressLogs } =
    recentSessionIds.length > 0
      ? await supabase
          .from("exercise_logs")
          .select("session_id, exercise_id, weight_kg, reps")
          .eq("user_id", userId)
          .in("session_id", recentSessionIds)
          .in("exercise_id", exerciseIds)
          .not("weight_kg", "is", null)
          .not("reps", "is", null)
      : {
          data: [] as Array<{
            session_id: string;
            exercise_id: string;
            weight_kg: number | null;
            reps: number | null;
          }>,
        };

  // Agrupa por exercise → { date → max 1RM no dia }
  type Point = { date: string; e1rm: number };
  const seriesByExercise = new Map<string, Point[]>();

  for (const l of progressLogs ?? []) {
    const occurredOn = sessionDateMap.get(l.session_id);
    if (!occurredOn) continue;
    const e1 = estimate1RM(l.weight_kg, l.reps);
    if (e1 == null) continue;
    const arr = seriesByExercise.get(l.exercise_id) ?? [];
    const existing = arr.find((p) => p.date === occurredOn);
    if (existing) {
      existing.e1rm = Math.max(existing.e1rm, e1);
    } else {
      arr.push({ date: occurredOn, e1rm: e1 });
    }
    seriesByExercise.set(l.exercise_id, arr);
  }
  for (const arr of seriesByExercise.values()) arr.sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <div className="grid gap-4">
      {prRows.map((r) => {
        const series = seriesByExercise.get(r.exercise_id) ?? [];
        return (
          <GlassCard key={r.exercise_id}>
            <div className="mb-2 flex items-end justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold">{r.exercise_name}</h3>
                <div
                  className="flex flex-wrap gap-2 text-[10px]"
                  style={{ color: "var(--color-fg-subtle)" }}
                >
                  {r.muscle_group ? <span>{r.muscle_group}</span> : null}
                  <span>· {r.total_sets} séries</span>
                  <span>· última: {formatDate(r.last_logged_on)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg" style={{ color: "var(--color-accent)" }}>
                  {r.best_1rm.toFixed(1)} kg
                </div>
                <div className="text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
                  1RM est. · max real {r.best_weight.toFixed(1)} kg
                </div>
              </div>
            </div>
            {series.length >= 2 ? (
              <ProgressionChart data={series} />
            ) : (
              <p className="text-xs italic" style={{ color: "var(--color-fg-subtle)" }}>
                Logue mais sessões pra ver a progressão.
              </p>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
