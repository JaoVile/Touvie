import { GlassCard } from "@/components/glass/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAY_LABELS, totalVolume } from "@/lib/workout";

interface Props {
  userId: string;
}

export async function HistoricoTab({ userId }: Props) {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, occurred_on, notes, program_day_id")
    .eq("user_id", userId)
    .order("occurred_on", { ascending: false })
    .limit(120);

  const sessionRows = (sessions ?? []) as Array<{
    id: string;
    occurred_on: string;
    notes: string | null;
    program_day_id: string | null;
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
    supabase
      .from("exercise_logs")
      .select("session_id, exercise_id, weight_kg, reps")
      .eq("user_id", userId)
      .in("session_id", sessionIds),
  ]);

  const dayMap = new Map(
    (daysRes.data ?? []).map((d) => [d.id, d as { id: string; name: string; weekday: number }]),
  );
  const logsBySession = new Map<
    string,
    Array<{ exercise_id: string; weight_kg: number | null; reps: number | null }>
  >();
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
                return (
                  <li
                    key={s.id}
                    className="rounded-lg px-3 py-2 text-sm"
                    style={{ background: "var(--color-card)" }}
                  >
                    <div className="flex items-center justify-between gap-2">
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
                      </div>
                      <span
                        className="font-mono text-[10px]"
                        style={{ color: "var(--color-fg-muted)" }}
                      >
                        {exerciseCount} ex · {setCount} séries · {volume.toLocaleString("pt-BR")} kg
                      </span>
                    </div>
                    {s.notes ? (
                      <p className="mt-1 text-xs italic" style={{ color: "var(--color-fg-muted)" }}>
                        {s.notes}
                      </p>
                    ) : null}
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
