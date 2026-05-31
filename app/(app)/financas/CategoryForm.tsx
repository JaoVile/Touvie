"use client";

import { useRef, useState, useTransition } from "react";
import { saveCategory } from "./actions";

export function CategoryForm() {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    setError(undefined);
    start(async () => {
      const res = await saveCategory(fd);
      if (res?.error) setError(res.error);
      else formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={submit} className="space-y-2 text-sm">
      <div className="grid grid-cols-[60px_1fr_auto] gap-2">
        <input
          type="text"
          name="emoji"
          maxLength={4}
          placeholder="🛒"
          className={inputCls}
          style={inputStyle}
        />
        <input
          type="text"
          name="name"
          required
          maxLength={60}
          placeholder="Nome"
          className={inputCls}
          style={inputStyle}
        />
        <select name="kind" defaultValue="expense" className={inputCls} style={inputStyle}>
          <option value="expense">Despesa</option>
          <option value="income">Receita</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-xs" style={{ color: "var(--color-fg-muted)" }}>
        Cor:
        <input
          type="color"
          name="color"
          defaultValue="#a855f7"
          className="h-8 w-12 cursor-pointer rounded border"
          style={{ borderColor: "var(--color-border)" }}
        />
      </label>
      {error ? <p style={{ color: "var(--color-danger)" }}>{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        {pending ? "Salvando…" : "Adicionar categoria"}
      </button>
    </form>
  );
}

const inputCls = "w-full rounded-lg border px-3 py-2 outline-none transition focus:ring-2";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
