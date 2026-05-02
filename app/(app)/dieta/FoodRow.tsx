"use client";

import { useState, useTransition } from "react";
import { deleteFood } from "./actions";

interface Food {
  id: string;
  name: string;
  kcal_per_100g: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  serving_g: number | null;
}

export function FoodRow({ food }: { food: Food }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  function remove() {
    if (!confirm(`Apagar "${food.name}"?`)) return;
    setError(undefined);
    start(async () => {
      const res = await deleteFood(food.id);
      if (res.error) setError(res.error);
    });
  }

  return (
    <li
      className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs"
      style={{ background: "var(--color-card)" }}
    >
      <span className="min-w-0 flex-1 truncate">{food.name}</span>
      <span className="font-mono text-[10px]" style={{ color: "var(--color-fg-muted)" }}>
        {food.kcal_per_100g}kcal · P{food.protein_g.toFixed(0)} · C{food.carb_g.toFixed(0)} · G
        {food.fat_g.toFixed(0)}
        {food.serving_g ? ` · ~${food.serving_g}g` : ""}
      </span>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded px-1 hover:opacity-80 disabled:opacity-40"
        style={{ color: "var(--color-fg-subtle)" }}
        aria-label="Apagar"
      >
        ×
      </button>
      {error ? (
        <span className="text-[9px]" style={{ color: "var(--color-danger)" }}>
          {error}
        </span>
      ) : null}
    </li>
  );
}
