"use client";

import { useState, useTransition } from "react";
import { seedDefaultCategories } from "./actions";

export function SeedCategoriesButton() {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function run() {
    setError(undefined);
    start(async () => {
      const res = await seedDefaultCategories();
      if (res?.error) setError(res.error);
    });
  }

  return (
    <span className="flex items-center gap-2">
      {error ? (
        <span className="text-xs" style={{ color: "var(--color-danger)" }}>
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
        {pending ? "Carregando…" : "Carregar padrões"}
      </button>
    </span>
  );
}
