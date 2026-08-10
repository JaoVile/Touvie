import { GlassCard } from "@/components/glass/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAY_LABELS, formatSet, totalVolume } from "@/lib/workout";
import { ChevronRight } from "lucide-react";

interface Props {
  userId: string;
}

interface LogRow {
  session_id: string;
  exercise_id: string;
  weight_kg: number | null;
  reps: number | null;
  set_number: number;
  rpe: number | null;
}

export async function HistoricoTab({ userId }: Props) {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, occurred_on, notes, program_day_id, completed_at")
    .eq("user_id", userId)
    .order("occurred_on", { ascending: false })
    .limit(120);

  const sessionRows = (sessions ?? []) as Array<{
    id: string;
    occurred_on: string;
    notes: string | null;
    program_day_id: string | null;
    completed_at: string | null;
  }>;

  if (sessionRows.length === 0) {
    return (
      <GlassCard>
        <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
          Nenhuma sessão registrada ainda. Comece um treino na aba <strong>Hoje</strong>.
        </p>
      </GlassCard>
    );
  }

  // Resolve nomes de dias e logs em batch
  const dayIds = Array.from(
    new Set(sessionRows.map((s) => s.program_day_id).filter(Boolean) as string[]),
  );
  const sessionIds = sessionRows.map((s) => s.id);

  const [daysRes, logsRes] = await Promise.all([
    dayIds.length > 0
      ? supabase
          .from("workout_days")
          .select("id, name, weekday")
          .eq("user_id", userId)
          .in("id", dayIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; weekday: number }> }),
    // set_number/rpe entram porque o detalhe expandido mostra série a série,
    // não só o agregado do cabeçalho.
    supabase
      .from("exercise_logs")
      .select("session_id, exercise_id, weight_kg, reps, set_number, rpe")
      .eq("user_id", userId)
      .in("session_id", sessionIds),
  ]);

  // Catálogo inteiro numa tacada: são dezenas de linhas, e resolver nome por
  // sessão daria N consultas.
  const { data: exercisesData } = await supabase
    .from("exercises")
    .select("id, name, muscle_group")
    .eq("user_id", userId);
  const exerciseMap = new Map(
    (exercisesData ?? []).map((e) => [
      e.id as string,
      e as { id: string; name: string; muscle_group: string | null },
    ]),
  );

  const dayMap = new Map(
    (daysRes.data ?? []).map((d) => [d.id, d as { id: string; name: string; weekday: number }]),
  );
  const logsBySession = new Map<string, LogRow[]>();
  for (const l of logsRes.data ?? []) {
    const arr = logsBySession.get(l.session_id) ?? [];
    arr.push(l);
    logsBySession.set(l.session_id, arr);
  }

  // Agrupa por mês pra leitura
  const byMonth = new Map<string, typeof sessionRows>();
  for (const s of sessionRows) {
    const key = s.occurred_on.slice(0, 7); // YYYY-MM
    const arr = byMonth.get(key) ?? [];
    arr.push(s);
    byMonth.set(key, arr);
  }

  return (
    <div className="grid gap-4">
      {Array.from(byMonth.entries()).map(([monthKey, sess]) => {
        const [y, m] = monthKey.split("-").map(Number);
        const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        });
        return (
          <GlassCard key={monthKey}>
            <h2
              className="mb-3 text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-fg-subtle)" }}
            >
              {monthLabel}
            </h2>
            <ul className="space-y-1.5">
              {sess.map((s) => {
                const sLogs = logsBySession.get(s.id) ?? [];
                const exerciseCount = new Set(sLogs.map((l) => l.exercise_id)).size;
                const setCount = sLogs.length;
                const volume = totalVolume(sLogs);
                const day = s.program_day_id ? dayMap.get(s.program_day_id) : null;
                // Agrupa por exercício preservando a ordem em que apareceram, e
                // ordena as séries DENTRO de cada grupo. Ordenar a consulta por
                // set_number faria o contrário: jogaria todas as séries 1 antes
                // de todas as 2, quebrando o agrupamento.
                const byExercise = new Map<string, LogRow[]>();
                for (const l of sLogs) {
                  const arr = byExercise.get(l.exercise_id) ?? [];
                  arr.push(l);
                  byExercise.set(l.exercise_id, arr);
                }
                for (const arr of byExercise.values()) {
                  arr.sort((a, b) => a.set_number - b.set_number);
                }
                const muscles = Array.from(
                  new Set(
                    Array.from(byExercise.keys())
                      .map((id) => exerciseMap.get(id)?.muscle_group)
                      .filter(Boolean) as string[],
                  ),
                );

                return (
                  <li key={s.id}>
                    <details
                      className="group rounded-lg px-3 py-2 text-sm"
                      style={{ background: "var(--color-card)" }}
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <ChevronRight
                            className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90"
                            style={{ color: "var(--color-fg-subtle)" }}
                          />
                          <div>
                            <span
                              className="font-mono text-xs"
                              style={{ color: "var(--color-fg-subtle)" }}
                            >
                              {formatDateShort(s.occurred_on)}
                            </span>{" "}
                            <span className="font-medium">{day?.name ?? "Treino livre"}</span>
                            {day ? (
                              <span
                                className="ml-2 rounded px-1.5 py-0.5 text-[9px] uppercase"
                                style={{
                                  background: "var(--color-bg-elevated)",
                                  color: "var(--color-fg-subtle)",
                                }}
                              >
                                {WEEKDAY_LABELS[day.weekday]}
                              </span>
                            ) : null}
                            {s.completed_at ? (
                              <span
                                className="ml-1.5 rounded px-1.5 py-0.5 text-[9px] uppercase"
                                style={{ background: "var(--color-success)", color: "white" }}
                              >
                                concluído
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span
                          className="shrink-0 font-mono text-[10px]"
                          style={{ color: "var(--color-fg-muted)" }}
                        >
                          {exerciseCount} ex · {setCount} séries · {volume.toLocaleString("pt-BR")}{" "}
                          kg
                        </span>
                      </summary>

                      {muscles.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {muscles.map((m) => (
                            <span
                              key={m}
                              className="rounded-full px-2 py-0.5 text-[10px]"
                              style={{
                                background: "var(--color-bg-elevated)",
                                color: "var(--color-fg-muted)",
                              }}
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {byExercise.size === 0 ? (
                        <p className="mt-2 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
                          Nenhuma série registrada nesta sessão.
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {Array.from(byExercise.entries()).map(([exId, exLogs]) => {
                            const ex = exerciseMap.get(exId);
                            return (
                              <li
                                key={exId}
                                className="border-t pt-2"
                                style={{ borderColor: "var(--color-border)" }}
                              >
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-xs font-medium">
                                    {ex?.name ?? "(exercício removido)"}
                                    {ex?.muscle_group ? (
                                      <span
                                        className="ml-1.5 font-normal text-[10px]"
                                        style={{ color: "var(--color-fg-subtle)" }}
                                      >
                                        {ex.muscle_group}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span
                                    className="shrink-0 font-mono text-[10px]"
                                    style={{ color: "var(--color-fg-subtle)" }}
                                  >
                                    {totalVolume(exLogs).toLocaleString("pt-BR")} kg
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {exLogs.map((l) => (
                                    <span
                                      key={`${exId}-${l.set_number}`}
                                      className="rounded px-1.5 py-0.5 font-mono text-[11px]"
                                      style={{
                                        background: "var(--color-bg-elevated)",
                                        color: "var(--color-fg)",
                                      }}
                                    >
                                      {formatSet(l.weight_kg, l.reps, l.rpe)}
                                    </span>
                                  ))}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {s.notes ? (
                        <p
                          className="mt-2 text-xs italic"
                          style={{ color: "var(--color-fg-muted)" }}
                        >
                          {s.notes}
                        </p>
                      ) : null}
                    </details>
                  </li>
                );
              })}
            </ul>
          </GlassCard>
        );
      })}
    </div>
  );
}

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
