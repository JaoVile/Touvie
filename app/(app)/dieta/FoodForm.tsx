"use client";

import { useRef, useState, useTransition } from "react";
import { saveFood } from "./actions";

export function FoodForm() {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    setError(undefined);
    start(async () => {
      const res = await saveFood(fd);
      if (res?.error) setError(res.error);
      else formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={submit} className="space-y-2 text-xs">
      <input
        type="text"
        name="name"
        required
        maxLength={80}
        placeholder="Nome (ex: Arroz integral cozido)"
        className={inputCls}
        style={inputStyle}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <NumField name="kcal_per_100g" placeholder="kcal/100g" required />
        <NumField name="protein_g" placeholder="proteína g" />
        <NumField name="carb_g" placeholder="carbo g" />
        <NumField name="fat_g" placeholder="gordura g" />
        <NumField name="fiber_g" placeholder="fibra g" />
      </div>
      <NumField name="serving_g" placeholder="porção padrão (g) — opcional" />
      {error ? (
        <p className="text-[11px]" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        {pending ? "Salvando…" : "Adicionar"}
      </button>
    </form>
  );
}

function NumField({
  name,
  placeholder,
  required,
}: {
  name: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <input
      type="number"
      name={name}
      step="0.1"
      min="0"
      placeholder={placeholder}
      required={required}
      className={inputCls}
      style={inputStyle}
    />
  );
}

const inputCls = "w-full rounded border px-2 py-1.5 outline-none";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
