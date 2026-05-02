"use client";

import { GlassCard } from "@/components/glass/GlassCard";
import { type Macros, ZERO_MACROS, formatGrams, sumMacros } from "@/lib/diet";
import { useState, useTransition } from "react";
import { addMealItem, deleteMeal, deleteMealItem, updateMealNotes } from "./actions";

interface Food {
  id: string;
  name: string;
  serving_g: number | null;
}

interface Item {
  id: string;
  food_id: string;
  foodName: string;
  grams: number;
  macros: Macros;
}

interface Props {
  mealType: string;
  label: string;
  emoji: string;
  mealId: string | null;
  mealNotes: string;
  items: Item[];
  occurredOn: string;
  foods: Food[];
}

export function MealCard({
  mealType,
  label,
  emoji,
  mealId,
  mealNotes,
  items,
  occurredOn,
  foods,
}: Props) {
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [foodId, setFoodId] = useState("");
  const [grams, setGrams] = useState("");
  const [error, setError] = useState<string>();
  const [notes, setNotes] = useState(mealNotes);
  const [showNotes, setShowNotes] = useState(false);

  const totals = items.length > 0 ? sumMacros(items.map((i) => i.macros)) : ZERO_MACROS;

  function add() {
    if (!foodId) return;
    setError(undefined);
    start(async () => {
      const res = await addMealItem({
        occurred_on: occurredOn,
        meal_type: mealType,
        food_id: foodId,
        grams,
      });
      if (res.error) setError(res.error);
      else {
        setFoodId("");
        setGrams("");
        setAdding(false);
      }
    });
  }

  function pickFood(id: string) {
    setFoodId(id);
    const f = foods.find((x) => x.id === id);
    if (f?.serving_g && !grams) setGrams(String(f.serving_g));
  }

  function removeItem(id: string) {
    start(async () => {
      await deleteMealItem(id);
    });
  }

  function clearMeal() {
    if (!mealId) return;
    if (!confirm(`Apagar tudo de ${label.toLowerCase()}?`)) return;
    start(async () => {
      await deleteMeal(mealId);
    });
  }

  async function saveNotes() {
    if (!mealId || notes === mealNotes) return;
    await updateMealNotes(mealId, notes);
  }

  return (
    <GlassCard>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold">
          <span className="mr-1.5">{emoji}</span>
          {label}
        </h3>
        <span className="font-mono text-xs" style={{ color: "var(--color-fg-muted)" }}>
          {Math.round(totals.kcal)} kcal · P {totals.protein_g.toFixed(0)} · C{" "}
          {totals.carb_g.toFixed(0)} · G {totals.fat_g.toFixed(0)}
        </span>
      </div>

      {items.length > 0 ? (
        <ul className="mb-2 space-y-1">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs"
              style={{ background: "var(--color-card)" }}
            >
              <span className="min-w-0 truncate">{it.foodName}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-mono" style={{ color: "var(--color-fg-muted)" }}>
                  {formatGrams(it.grams)} · {Math.round(it.macros.kcal)} kcal
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  disabled={pending}
                  className="rounded px-1 hover:opacity-80 disabled:opacity-40"
                  style={{ color: "var(--color-fg-subtle)" }}
                  aria-label="Remover"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <div className="grid grid-cols-[1fr_80px_auto_auto] gap-1.5 text-xs">
          <select
            value={foodId}
            onChange={(e) => pickFood(e.target.value)}
            className={inputCls}
            style={inputStyle}
          >
            <option value="">— alimento —</option>
            {foods.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            inputMode="decimal"
            step="1"
            min="1"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            placeholder="g"
            className={inputCls}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={add}
            disabled={pending || !foodId || !grams}
            className="rounded px-3 font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--gradient-brand)" }}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setFoodId("");
              setGrams("");
              setError(undefined);
            }}
            className="rounded px-2 hover:opacity-80"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full rounded-lg border-2 border-dashed px-3 py-1.5 text-xs font-medium hover:opacity-80"
          style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
        >
          + adicionar item
        </button>
      )}
      {error ? (
        <p className="mt-1 text-[10px]" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}

      {mealId ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            className="text-[10px] underline"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            {showNotes ? "esconder notas" : "notas"}
            {mealNotes ? " (preenchido)" : ""}
          </button>
          <button
            type="button"
            onClick={clearMeal}
            disabled={pending}
            className="text-[10px] underline disabled:opacity-40"
            style={{ color: "var(--color-danger)" }}
          >
            apagar refeição
          </button>
        </div>
      ) : null}

      {mealId && showNotes ? (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          rows={2}
          placeholder="Notas (como se sentiu, fome, etc.)"
          className="mt-2 w-full resize-y rounded border px-2 py-1.5 text-xs outline-none"
          style={{
            background: "var(--color-card)",
            borderColor: "var(--color-border)",
            color: "var(--color-fg)",
          }}
        />
      ) : null}
    </GlassCard>
  );
}

const inputCls = "rounded border px-2 py-1.5 outline-none";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
