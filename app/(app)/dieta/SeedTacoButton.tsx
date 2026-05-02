"use client";

import { useState, useTransition } from "react";
import { seedTacoFoods } from "./actions";

export function SeedTacoButton() {
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [pending, start] = useTransition();

  function run() {
    setError(undefined);
    setInfo(undefined);
    start(async () => {
      const res = await seedTacoFoods();
      if (res.error) setError(res.error);
      else setInfo(`✓ ${res.count} alimentos carregados`);
    });
  }

  return (
    <span className="flex items-center gap-2">
      {info ? (
        <span className="text-[10px]" style={{ color: "var(--color-success)" }}>
          {info}
        </span>
      ) : null}
      {error ? (
        <span className="text-[10px]" style={{ color: "var(--color-danger)" }}>
          {error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-lg px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        {pending ? "Carregando…" : "Carregar TACO"}
      </button>
    </span>
  );
}
