"use client";

import { useRef, useState, useTransition } from "react";
import { saveProgram } from "./actions";

interface Props {
  defaultValues?: { id: string; name: string };
  onDone?: () => void;
}

export function ProgramForm({ defaultValues, onDone }: Props = {}) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    setError(undefined);
    start(async () => {
      const res = await saveProgram(fd);
      if (res?.error) setError(res.error);
      else if (defaultValues?.id) onDone?.();
      else formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={submit} className="flex gap-2 text-sm">
      {defaultValues?.id ? <input type="hidden" name="id" value={defaultValues.id} /> : null}
      <input
        type="text"
        name="name"
        required
        maxLength={80}
        defaultValue={defaultValues?.name ?? ""}
        placeholder="Nome do programa"
        className="flex-1 rounded-lg border px-3 py-2 outline-none focus:ring-2"
        style={{
          background: "var(--color-card)",
          borderColor: "var(--color-border)",
          color: "var(--color-fg)",
        }}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        {pending ? "…" : defaultValues?.id ? "Atualizar" : "Criar"}
      </button>
      {error ? (
        <span className="text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </span>
      ) : null}
    </form>
  );
}
