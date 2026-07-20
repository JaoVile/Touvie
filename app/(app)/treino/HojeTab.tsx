import { GlassCard } from "@/components/glass/GlassCard";
import { todayBRT, todayBRTISO } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAY_LABELS, formatRepsTarget } from "@/lib/workout";
import Link from "next/link";
import { SessionLogger } from "./SessionLogger";
import { StartSessionButton } from "./StartSessionButton";

interface Props {
  userId: string;
}

interface Exercise {
  id: string;
  name: string;
  muscle_group: string | null;
}

interface Planned {
  id: string;
  exercise_id: string;
  sort_order: number;
  target_sets: number | null;
  target_reps_low: number | null;
  target_reps_high: number | null;
  notes: string | null;
}

export async function HojeTab({ userId }: Props) {
  const supabase = await createClient();
  const today = todayBRTISO();
  const weekday = todayBRT().getUTCDay();

  // 1-3) Independentes entre si → uma onda só: sessão de hoje, programa ativo e
  // catálogo de exercícios (antes eram 3 awaits em série).
  const [{ data: session }, { data: program }, { data: exercisesRaw }] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, program_day_id, occurred_on, notes")
      .eq("user_id", userId)
      .eq("occurred_on", today)
      .maybeSingle(),
    supabase
      .from("workout_programs")
      .select("id, name")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("exercises").select("id, name, muscle_group").eq("user_id", userId).order("name"),
  ]);

  // O dia do programa p/ hoje depende do programa ativo → segunda onda.
  const programDayQ = program
    ? await supabase
        .from("workout_days")
        .select("id, name")
        .eq("user_id", userId)
        .eq("program_id", program.id)
        .eq("weekday", weekday)
        .maybeSingle()
    : null;
  const programDay = programDayQ?.data ?? null;

  const exercises = (exercisesRaw ?? []) as Exercise[];
  const exMap = new Map(exercises.map((e) => [e.id, e]));

  // 4) Se sessão existe → carrega planejados + logs
  if (session) {
    const dayId = session.program_day_id ?? programDay?.id ?? null;
    const [plannedRes, logsRes] = await Promise.all([
      dayId
        ? supabase
            .from("workout_day_exercises")
            .select(
              "id, exercise_id, sort_order, target_sets, target_reps_low, target_reps_high, notes",
            )
            .eq("user_id", userId)
            .eq("program_day_id", dayId)
            .order("sort_order")
        : Promise.resolve({ data: [] as Planned[] }),
      supabase
        .from("exercise_logs")
        .select("id, exercise_id, set_number, reps, weight_kg, rpe")
        .eq("user_id", userId)
        .eq("session_id", session.id)
        .order("set_number"),
    ]);

    const planned = (plannedRes.data ?? []) as Planned[];
    // Anexa info do exercício a partir do catálogo
    const plannedWithEx = planned.map((p) => ({
      ...p,
      exercise: exMap.get(p.exercise_id) ?? null,
    }));

    return (
      <SessionLogger
        sessionId={session.id}
        sessionNotes={session.notes ?? ""}
        weekdayLabel={WEEKDAY_LABELS[weekday]}
        dayName={programDay?.name ?? null}
        planned={plannedWithEx}
        logs={(logsRes.data ?? []) as LogRow[]}
        catalog={exercises}
      />
    );
  }

  // 5) Sem sessão ainda → preview do template do dia ou empty state
  if (programDay) {
    const { data: plannedData } = await supabase
      .from("workout_day_exercises")
      .select("id, exercise_id, target_sets, target_reps_low, target_reps_high, notes")
      .eq("user_id", userId)
      .eq("program_day_id", programDay.id)
      .order("sort_order");
    const planned = (plannedData ?? []) as Planned[];

    return (
      <div className="grid gap-4">
        <GlassCard>
          <div className="mb-3">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              {WEEKDAY_LABELS[weekday]}
            </span>
            <h2 className="mt-2 text-lg font-semibold">{programDay.name}</h2>
            <p className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>
              Programa: {program?.name ?? "—"}
            </p>
          </div>

          {planned.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Sem exercícios planejados pra este dia. Configure em <strong>Programas</strong> ou
              comece um treino livre.
            </p>
          ) : (
            <ul className="space-y-2">
              {planned.map((p) => {
                const ex = exMap.get(p.exercise_id) ?? null;
                return (
                  <li
                    key={p.id}
                    className="rounded-lg px-3 py-2 text-sm"
                    style={{ background: "var(--color-card)" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{ex?.name ?? "(sem exercício)"}</span>
                      <span
                        className="font-mono text-xs"
                        style={{ color: "var(--color-fg-muted)" }}
                      >
                        {p.target_sets ?? "?"} ×{" "}
                        {formatRepsTarget(p.target_reps_low, p.target_reps_high)}
                      </span>
                    </div>
                    {ex?.muscle_group ? (
                      <p className="mt-0.5 text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
                        {ex.muscle_group}
                      </p>
                    ) : null}
                    {p.notes ? (
                      <p className="mt-1 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
                        {p.notes}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4">
            <StartSessionButton programDayId={programDay.id} label="Iniciar treino" />
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <GlassCard>
      <h2 className="mb-2 text-lg font-semibold">Sem programa pra hoje</h2>
      <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
        Hoje é {WEEKDAY_LABELS[weekday].toLowerCase()} — seu programa ativo não tem dia configurado.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <StartSessionButton programDayId={null} label="Treino livre" />
        <Link
          href="/treino?t=programas"
          className="rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
        >
          Configurar programa →
        </Link>
      </div>
    </GlassCard>
  );
}

type LogRow = {
  id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
};
