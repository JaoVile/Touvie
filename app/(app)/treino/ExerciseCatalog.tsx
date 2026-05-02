"use client";

import { MUSCLE_GROUPS } from "@/lib/workout";
import { useRef, useState, useTransition } from "react";
import { deleteExercise, saveExercise } from "./actions";

interface Exercise {
  id: string;
  name: string;
  muscle_group: string | null;
  notes: string | null;
}

interface Props {
  exercises: Exercise[];
}

export function ExerciseCatalog({ exercises }: Props) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    setError(undefined);
    start(async () => {
      const res = await saveExercise(fd);
      if (res?.error) setError(res.error);
      else formRef.current?.reset();
    });
  }

  function remove(id: string, name: string) {
    if (!confirm(`Apagar "${name}"?`)) return;
    setError(undefined);
    start(async () => {
      const res = await deleteExercise(id);
      if (res.error) setError(res.error);
    });
  }

  // Agrupa por muscle_group pra ler melhor
  const byGroup = new Map<string, Exercise[]>();
  for (const e of exercises) {
    const k = e.muscle_group ?? "Sem grupo";
    const arr = byGroup.get(k) ?? [];
    arr.push(e);
    byGroup.set(k, arr);
  }

  return (
    <div className="space-y-3 text-sm">
      {exercises.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
          Catálogo vazio. Adicione exercícios pra usar nos programas.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from(byGroup.entries()).map(([group, items]) => (
            <div key={group}>
              <h3
                className="mb-1 text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-fg-subtle)" }}
              >
                {group}
              </h3>
              <ul className="space-y-1">
                {items.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs"
                    style={{ background: "var(--color-card)" }}
                  >
                    <span className="truncate">{e.name}</span>
                    <button
                      type="button"
                      onClick={() => remove(e.id, e.name)}
                      disabled={pending}
                      className="rounded px-1 hover:opacity-80 disabled:opacity-40"
                      style={{ color: "var(--color-fg-subtle)" }}
                      aria-label="Apagar"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <form
        ref={formRef}
        action={submit}
        className="grid grid-cols-[1fr_140px_auto] gap-1.5 text-xs"
      >
        <input
          type="text"
          name="name"
          required
          maxLength={80}
          placeholder="Nome (Supino reto)"
          className={inputCls}
          style={inputStyle}
        />
        <select name="muscle_group" defaultValue="" className={inputCls} style={inputStyle}>
          <option value="">— grupo —</option>
          {MUSCLE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded px-3 font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          +
        </button>
      </form>
      {error ? (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputCls = "rounded border px-2 py-1.5 outline-none";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
