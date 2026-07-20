"use client";

import { MUSCLE_GROUPS } from "@/lib/workout";
import { useState, useTransition } from "react";
import { saveExercise } from "./actions";

interface Props {
  defaultValues: {
    id: string;
    name: string;
    muscle_group: string | null;
    notes: string | null;
  };
  onDone?: () => void;
}

/**
 * Form de EDIÇÃO de um exercício do catálogo (aberto inline pela linha). Recebe
 * `defaultValues` com `id`, monta o hidden `id` pra a action fazer UPDATE e chama
 * `onDone` no sucesso (a linha fecha o modo de edição; a lista revalida sozinha).
 */
export function ExerciseForm({ defaultValues, onDone }: Props) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    setError(undefined);
    start(async () => {
      const res = await saveExercise(fd);
      if (res?.error) setError(res.error);
      else onDone?.();
    });
  }

  return (
    <form action={submit} className="grid gap-1.5 text-xs">
      <input type="hidden" name="id" value={defaultValues.id} />
      <input
        type="text"
        name="name"
        required
        maxLength={80}
        defaultValue={defaultValues.name}
        placeholder="Nome (Supino reto)"
        className={inputCls}
        style={inputStyle}
      />
      <select
        aria-label="Grupo muscular"
        name="muscle_group"
        defaultValue={defaultValues.muscle_group ?? ""}
        className={inputCls}
        style={inputStyle}
      >
        <option value="">— grupo —</option>
        {MUSCLE_GROUPS.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
      <input
        type="text"
        name="notes"
        maxLength={500}
        defaultValue={defaultValues.notes ?? ""}
        placeholder="Notas (opcional)"
        className={inputCls}
        style={inputStyle}
      />
      {error ? <p style={{ color: "var(--color-danger)" }}>{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded px-3 py-1.5 font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        {pending ? "Salvando…" : "Atualizar"}
      </button>
    </form>
  );
}

const inputCls = "rounded border px-2 py-1.5 outline-none";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
