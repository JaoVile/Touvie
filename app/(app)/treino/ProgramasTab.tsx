import { GlassCard } from "@/components/glass/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { ExerciseCatalog } from "./ExerciseCatalog";
import { ProgramCard } from "./ProgramCard";
import { ProgramForm } from "./ProgramForm";

interface Props {
  userId: string;
}

export async function ProgramasTab({ userId }: Props) {
  const supabase = await createClient();

  const [progRes, daysRes, dayExRes, exRes] = await Promise.all([
    supabase
      .from("workout_programs")
      .select("id, name, active, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("workout_days")
      .select("id, program_id, weekday, name")
      .eq("user_id", userId)
      .order("weekday"),
    supabase
      .from("workout_day_exercises")
      .select(
        "id, program_day_id, exercise_id, sort_order, target_sets, target_reps_low, target_reps_high, notes",
      )
      .eq("user_id", userId)
      .order("sort_order"),
    supabase
      .from("exercises")
      .select("id, name, muscle_group, notes")
      .eq("user_id", userId)
      .order("name"),
  ]);

  const programs = (progRes.data ?? []) as Array<{
    id: string;
    name: string;
    active: boolean;
    created_at: string;
  }>;
  const days = (daysRes.data ?? []) as Array<{
    id: string;
    program_id: string;
    weekday: number;
    name: string;
  }>;
  const dayExercises = (dayExRes.data ?? []) as Array<{
    id: string;
    program_day_id: string;
    exercise_id: string;
    sort_order: number;
    target_sets: number | null;
    target_reps_low: number | null;
    target_reps_high: number | null;
    notes: string | null;
  }>;
  const exercises = (exRes.data ?? []) as Array<{
    id: string;
    name: string;
    muscle_group: string | null;
    notes: string | null;
  }>;

  // Index days por program e exercises por day
  const daysByProgram = new Map<string, typeof days>();
  for (const d of days) {
    const arr = daysByProgram.get(d.program_id) ?? [];
    arr.push(d);
    daysByProgram.set(d.program_id, arr);
  }
  const exByDay = new Map<string, typeof dayExercises>();
  for (const de of dayExercises) {
    const arr = exByDay.get(de.program_day_id) ?? [];
    arr.push(de);
    exByDay.set(de.program_day_id, arr);
  }

  return (
    <div className="grid gap-4">
      <GlassCard>
        <h2 className="mb-3 text-sm font-semibold">🗂️ Programas</h2>
        <p className="mb-3 text-xs" style={{ color: "var(--color-fg-muted)" }}>
          Um programa é o seu "split" (ex: Push/Pull/Legs). Cada dia agrupa exercícios planejados.
          Apenas um programa pode estar <strong>ativo</strong> — ele define o treino sugerido em
          "Hoje" baseado no dia da semana.
        </p>

        <div className="mb-4 grid gap-2">
          {programs.length === 0 ? (
            <p className="text-xs italic" style={{ color: "var(--color-fg-subtle)" }}>
              Nenhum programa ainda. Crie o primeiro abaixo.
            </p>
          ) : (
            programs.map((p) => (
              <ProgramCard
                key={p.id}
                program={p}
                days={daysByProgram.get(p.id) ?? []}
                exByDay={exByDay}
                exercises={exercises}
              />
            ))
          )}
        </div>

        <h3
          className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          Novo programa
        </h3>
        <ProgramForm />
      </GlassCard>

      <GlassCard>
        <h2 className="mb-3 text-sm font-semibold">📋 Catálogo de exercícios</h2>
        <p className="mb-3 text-xs" style={{ color: "var(--color-fg-muted)" }}>
          Cadastre os exercícios que você usa. Eles ficam disponíveis pra adicionar nos dias do
          programa e na sessão do dia.
        </p>
        <ExerciseCatalog exercises={exercises} />
      </GlassCard>
    </div>
  );
}
