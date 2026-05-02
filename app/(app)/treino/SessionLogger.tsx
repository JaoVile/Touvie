"use client";

import { GlassCard } from "@/components/glass/GlassCard";
import { estimate1RM, formatRepsTarget, formatSet, totalVolume } from "@/lib/workout";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteLog, deleteSession, saveLog, updateSessionNotes } from "./actions";

interface Planned {
  id: string;
  exercise_id: string;
  sort_order: number;
  target_sets: number | null;
  target_reps_low: number | null;
  target_reps_high: number | null;
  notes: string | null;
  exercise: { name: string; muscle_group: string | null } | null;
}

interface Log {
  id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  created_at: string;
}

interface Catalog {
  id: string;
  name: string;
  muscle_group: string | null;
}

interface Props {
  sessionId: string;
  sessionNotes: string;
  weekdayLabel: string;
  dayName: string | null;
  planned: Planned[];
  logs: Log[];
  catalog: Catalog[];
}

export function SessionLogger({
  sessionId,
  sessionNotes,
  weekdayLabel,
  dayName,
  planned,
  logs,
  catalog,
}: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(sessionNotes);
  const [adhocExerciseIds, setAdhocExerciseIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [pickerValue, setPickerValue] = useState("");

  // Mapa exercise_id → planejado
  const plannedById = useMemo(() => {
    const m = new Map<string, Planned>();
    for (const p of planned) m.set(p.exercise_id, p);
    return m;
  }, [planned]);

  // Catálogo por id
  const catalogById = useMemo(() => {
    const m = new Map<string, Catalog>();
    for (const c of catalog) m.set(c.id, c);
    return m;
  }, [catalog]);

  // Lista final de exercícios (planejados + ad-hoc + qualquer com log)
  const exerciseIds = useMemo(() => {
    const s = new Set<string>();
    for (const p of planned) s.add(p.exercise_id);
    for (const l of logs) s.add(l.exercise_id);
    for (const id of adhocExerciseIds) s.add(id);
    return Array.from(s);
  }, [planned, logs, adhocExerciseIds]);

  // Logs por exercise_id
  const logsByExercise = useMemo(() => {
    const m = new Map<string, Log[]>();
    for (const l of logs) {
      const arr = m.get(l.exercise_id) ?? [];
      arr.push(l);
      m.set(l.exercise_id, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.set_number - b.set_number);
    return m;
  }, [logs]);

  const sessionVolume = totalVolume(logs);
  const totalSets = logs.length;

  function addAdhoc(id: string) {
    if (!id) return;
    setAdhocExerciseIds((cur) => (cur.includes(id) ? cur : [...cur, id]));
    setPickerValue("");
    setAdding(false);
  }

  async function notesBlur() {
    if (notes !== sessionNotes) {
      await updateSessionNotes(sessionId, notes);
    }
  }

  async function endSession() {
    if (
      !confirm(
        "Encerrar e apagar a sessão de hoje? Os logs também serão apagados.\nUse só se quiser começar do zero.",
      )
    )
      return;
    await deleteSession(sessionId);
    router.refresh();
  }

  // Ainda não tem nenhum exercício
  const empty = exerciseIds.length === 0;

  // Catálogo disponível pra adicionar (ainda não no treino)
  const availableForAdd = catalog.filter((c) => !exerciseIds.includes(c.id));

  return (
    <div className="grid gap-4">
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              Em andamento
            </span>
            <h2 className="mt-2 text-lg font-semibold">
              {dayName ?? "Treino livre"}{" "}
              <span className="font-normal text-sm" style={{ color: "var(--color-fg-subtle)" }}>
                · {weekdayLabel}
              </span>
            </h2>
          </div>
          <div className="flex flex-wrap gap-3 text-xs" style={{ color: "var(--color-fg-muted)" }}>
            <span>
              <strong>{totalSets}</strong> séries
            </span>
            <span>
              Vol: <strong>{sessionVolume.toLocaleString("pt-BR")} kg</strong>
            </span>
          </div>
        </div>
      </GlassCard>

      {empty ? (
        <GlassCard>
          <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
            Nenhum exercício na sessão. Adicione do catálogo abaixo.
          </p>
          <ExercisePicker
            options={availableForAdd}
            value={pickerValue}
            onChange={setPickerValue}
            onAdd={addAdhoc}
          />
        </GlassCard>
      ) : (
        <>
          {exerciseIds.map((exId) => {
            const plan = plannedById.get(exId);
            const cat = catalogById.get(exId);
            const exLogs = logsByExercise.get(exId) ?? [];
            const name = plan?.exercise?.name ?? cat?.name ?? "(exercício)";
            return (
              <ExerciseBlock
                key={exId}
                sessionId={sessionId}
                exerciseId={exId}
                name={name}
                muscleGroup={plan?.exercise?.muscle_group ?? cat?.muscle_group ?? null}
                target={
                  plan
                    ? `${plan.target_sets ?? "?"} × ${formatRepsTarget(plan.target_reps_low, plan.target_reps_high)}`
                    : null
                }
                planNotes={plan?.notes ?? null}
                logs={exLogs}
                onChange={() => router.refresh()}
              />
            );
          })}

          <GlassCard>
            {adding ? (
              <ExercisePicker
                options={availableForAdd}
                value={pickerValue}
                onChange={setPickerValue}
                onAdd={addAdhoc}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="w-full rounded-lg border-2 border-dashed px-3 py-2 text-sm font-medium hover:opacity-80"
                style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
              >
                + Adicionar outro exercício
              </button>
            )}
          </GlassCard>
        </>
      )}

      <GlassCard>
        <label
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          Notas da sessão
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={notesBlur}
          rows={2}
          placeholder="Como foi o treino, energia, observações…"
          className="w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--color-card)",
            borderColor: "var(--color-border)",
            color: "var(--color-fg)",
          }}
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={endSession}
            className="text-xs underline"
            style={{ color: "var(--color-danger)" }}
          >
            apagar sessão de hoje
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

function ExercisePicker({
  options,
  value,
  onChange,
  onAdd,
}: {
  options: Catalog[];
  value: string;
  onChange: (v: string) => void;
  onAdd: (id: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
        style={{
          background: "var(--color-card)",
          borderColor: "var(--color-border)",
          color: "var(--color-fg)",
        }}
      >
        <option value="">— Escolha do catálogo —</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.muscle_group ? ` (${c.muscle_group})` : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onAdd(value)}
        disabled={!value}
        className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        style={{ background: "var(--gradient-brand)" }}
      >
        Adicionar
      </button>
    </div>
  );
}

function ExerciseBlock({
  sessionId,
  exerciseId,
  name,
  muscleGroup,
  target,
  planNotes,
  logs,
  onChange,
}: {
  sessionId: string;
  exerciseId: string;
  name: string;
  muscleGroup: string | null;
  target: string | null;
  planNotes: string | null;
  logs: Log[];
  onChange: () => void;
}) {
  const [pending, start] = useTransition();
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState(() => {
    const last = logs[logs.length - 1];
    return last?.weight_kg != null ? String(last.weight_kg) : "";
  });
  const [rpe, setRpe] = useState("");
  const [error, setError] = useState<string>();

  const nextSet = (logs[logs.length - 1]?.set_number ?? 0) + 1;
  const best1rm = logs.reduce<number | null>((b, l) => {
    const r = estimate1RM(l.weight_kg, l.reps);
    if (r == null) return b;
    return b == null ? r : Math.max(b, r);
  }, null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reps && !weight) return;
    setError(undefined);
    start(async () => {
      const res = await saveLog({
        session_id: sessionId,
        exercise_id: exerciseId,
        set_number: nextSet,
        reps,
        weight_kg: weight,
        rpe,
      });
      if (res.error) setError(res.error);
      else {
        setReps("");
        setRpe("");
        // peso fica preenchido pra próxima série
        onChange();
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteLog(id);
      onChange();
    });
  }

  return (
    <GlassCard>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <h3 className="font-semibold">{name}</h3>
          <div
            className="flex flex-wrap gap-2 text-[10px]"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            {muscleGroup ? <span>{muscleGroup}</span> : null}
            {target ? <span>· meta: {target}</span> : null}
            {best1rm != null ? <span>· 1RM est. hoje: {best1rm.toFixed(1)} kg</span> : null}
          </div>
          {planNotes ? (
            <p className="mt-1 text-xs italic" style={{ color: "var(--color-fg-muted)" }}>
              {planNotes}
            </p>
          ) : null}
        </div>
      </div>

      {logs.length > 0 ? (
        <ul className="mb-2 space-y-1">
          {logs.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between rounded px-2 py-1 text-xs"
              style={{ background: "var(--color-card)" }}
            >
              <span className="font-mono">
                <span style={{ color: "var(--color-fg-subtle)" }}>#{l.set_number}</span>{" "}
                {formatSet(l.weight_kg, l.reps, l.rpe)}
              </span>
              <button
                type="button"
                onClick={() => remove(l.id)}
                disabled={pending}
                className="rounded px-1 hover:opacity-80 disabled:opacity-40"
                style={{ color: "var(--color-fg-subtle)" }}
                aria-label="Apagar série"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={submit} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-1.5 text-xs">
        <span
          className="flex items-center justify-center rounded px-2 font-mono"
          style={{ background: "var(--color-card)", color: "var(--color-fg-subtle)" }}
        >
          #{nextSet}
        </span>
        <input
          type="number"
          step="0.5"
          inputMode="decimal"
          placeholder="kg"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className={inputCls}
          style={inputStyle}
        />
        <input
          type="number"
          inputMode="numeric"
          placeholder="reps"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          className={inputCls}
          style={inputStyle}
        />
        <input
          type="number"
          inputMode="numeric"
          min="1"
          max="10"
          placeholder="RPE"
          value={rpe}
          onChange={(e) => setRpe(e.target.value)}
          className={inputCls}
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={pending || (!reps && !weight)}
          className="rounded px-3 font-semibold text-white disabled:opacity-40"
          style={{ background: "var(--gradient-brand)" }}
        >
          +
        </button>
      </form>
      {error ? (
        <p className="mt-1 text-[10px]" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
    </GlassCard>
  );
}

const inputCls = "w-full rounded border px-2 py-1.5 text-center font-mono outline-none";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
