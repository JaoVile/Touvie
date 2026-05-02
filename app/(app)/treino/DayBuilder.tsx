"use client";

import { formatRepsTarget } from "@/lib/workout";
import { useState, useTransition } from "react";
import { removeDayExercise, reorderDayExercise, saveDayExercise } from "./actions";

interface DayExercise {
  id: string;
  program_day_id: string;
  exercise_id: string;
  sort_order: number;
  target_sets: number | null;
  target_reps_low: number | null;
  target_reps_high: number | null;
  notes: string | null;
}

interface Exercise {
  id: string;
  name: string;
  muscle_group: string | null;
}

interface Props {
  dayId: string;
  dayExercises: DayExercise[];
  exercises: Exercise[];
}

export function DayBuilder({ dayId, dayExercises, exercises }: Props) {
  const [pending, start] = useTransition();
  const [pickerId, setPickerId] = useState("");
  const [sets, setSets] = useState("3");
  const [low, setLow] = useState("8");
  const [high, setHigh] = useState("12");
  const [error, setError] = useState<string>();

  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const used = new Set(dayExercises.map((d) => d.exercise_id));
  const available = exercises.filter((e) => !used.has(e.id));

  function add() {
    if (!pickerId) return;
    setError(undefined);
    const fd = new FormData();
    fd.set("program_day_id", dayId);
    fd.set("exercise_id", pickerId);
    fd.set("target_sets", sets);
    fd.set("target_reps_low", low);
    fd.set("target_reps_high", high);
    start(async () => {
      const res = await saveDayExercise(fd);
      if (res?.error) setError(res.error);
      else setPickerId("");
    });
  }

  function remove(id: string) {
    start(async () => {
      await removeDayExercise(id);
    });
  }

  function move(id: string, direction: -1 | 1) {
    start(async () => {
      await reorderDayExercise(id, direction);
    });
  }

  return (
    <div className="space-y-1.5 text-xs">
      {dayExercises.map((de, i) => {
        const ex = exMap.get(de.exercise_id);
        return (
          <div
            key={de.id}
            className="flex items-center justify-between gap-2 rounded px-2 py-1.5"
            style={{ background: "var(--color-card)" }}
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium">{ex?.name ?? "—"}</div>
              <div className="text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
                {de.target_sets ?? "?"} ×{" "}
                {formatRepsTarget(de.target_reps_low, de.target_reps_high)}
                {ex?.muscle_group ? ` · ${ex.muscle_group}` : ""}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => move(de.id, -1)}
                disabled={pending || i === 0}
                className="rounded px-1 text-[11px] hover:opacity-80 disabled:opacity-30"
                style={{ color: "var(--color-fg-subtle)" }}
                aria-label="Subir"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(de.id, 1)}
                disabled={pending || i === dayExercises.length - 1}
                className="rounded px-1 text-[11px] hover:opacity-80 disabled:opacity-30"
                style={{ color: "var(--color-fg-subtle)" }}
                aria-label="Descer"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(de.id)}
                disabled={pending}
                className="rounded px-1 text-[11px] hover:opacity-80 disabled:opacity-40"
                style={{ color: "var(--color-danger)" }}
                aria-label="Remover"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}

      {available.length === 0 && exercises.length === 0 ? (
        <p className="italic" style={{ color: "var(--color-fg-subtle)" }}>
          Catálogo vazio — cadastre exercícios no card abaixo.
        </p>
      ) : (
        <div className="grid grid-cols-[1fr_44px_44px_44px_auto] gap-1 pt-1">
          <select
            value={pickerId}
            onChange={(e) => setPickerId(e.target.value)}
            className={inputCls}
            style={inputStyle}
          >
            <option value="">— exercício —</option>
            {available.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            max="20"
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            placeholder="sets"
            className={inputCls}
            style={inputStyle}
          />
          <input
            type="number"
            min="1"
            max="50"
            value={low}
            onChange={(e) => setLow(e.target.value)}
            placeholder="min"
            className={inputCls}
            style={inputStyle}
          />
          <input
            type="number"
            min="1"
            max="50"
            value={high}
            onChange={(e) => setHigh(e.target.value)}
            placeholder="max"
            className={inputCls}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={add}
            disabled={pending || !pickerId}
            className="rounded px-2 font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--gradient-brand)" }}
          >
            +
          </button>
        </div>
      )}
      {error ? (
        <p className="text-[10px]" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputCls = "rounded border px-2 py-1.5 text-center font-mono outline-none";
const inputStyle: React.CSSProperties = {
  background: "var(--color-bg-elevated)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
