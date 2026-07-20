"use client";

import { MUSCLE_GROUPS } from "@/lib/workout";
import { Pencil } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { ExerciseForm } from "./ExerciseForm";
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
                  <ExerciseRow
                    key={e.id}
                    exercise={e}
                    onRemove={() => remove(e.id, e.name)}
                    pending={pending}
                  />
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

// Linha do catálogo: mostra o nome + lápis (editar inline) e × (apagar). Ao
// editar, troca a linha pelo ExerciseForm preenchido; ao salvar/cancelar, volta.
function ExerciseRow({
  exercise,
  onRemove,
  pending,
}: {
  exercise: Exercise;
  onRemove: () => void;
  pending: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="rounded px-2 py-2 text-xs" style={{ background: "var(--color-card)" }}>
        <ExerciseForm
          defaultValues={{
            id: exercise.id,
            name: exercise.name,
            muscle_group: exercise.muscle_group,
            notes: exercise.notes,
          }}
          onDone={() => setEditing(false)}
        />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mt-1.5 w-full text-[10px]"
          style={{ color: "var(--color-fg-muted)" }}
        >
          cancelar
        </button>
      </li>
    );
  }

  return (
    <li
      className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs"
      style={{ background: "var(--color-card)" }}
    >
      <span className="truncate">{exercise.name}</span>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded p-1 hover:opacity-80"
          style={{ color: "var(--color-fg-subtle)" }}
          aria-label="Editar exercício"
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={pending}
          className="rounded px-1 hover:opacity-80 disabled:opacity-40"
          style={{ color: "var(--color-fg-subtle)" }}
          aria-label="Apagar"
        >
          ×
        </button>
      </div>
    </li>
  );
}

const inputCls = "rounded border px-2 py-1.5 outline-none";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
