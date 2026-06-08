import { GlassCard } from "@/components/glass/GlassCard";
import { addDaysISO, dayLabelBR, todayBRTISO } from "@/lib/datetime";
import {
  MEAL_TYPE_LABELS,
  MEAL_TYPE_ORDER,
  type Macros,
  type MealType,
  ZERO_MACROS,
  macrosFor,
  sumMacros,
} from "@/lib/diet";
import { createClient } from "@/lib/supabase/server";
import {
  Apple,
  Coffee,
  Croissant,
  Dumbbell,
  GlassWater,
  type LucideIcon,
  Utensils,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { MacrosBar } from "./MacrosBar";
import { MealCard } from "./MealCard";

const MEAL_TYPE_ICONS: Record<MealType, LucideIcon> = {
  breakfast: Croissant,
  snack: Apple,
  lunch: UtensilsCrossed,
  pre: Dumbbell,
  post: GlassWater,
  dinner: Utensils,
  other: Coffee,
};

interface Props {
  userId: string;
  date: string;
}

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

interface MealRow {
  id: string;
  meal_type: MealType;
  notes: string | null;
}

interface ItemRow {
  id: string;
  meal_id: string;
  food_id: string;
  grams: number;
}

export async function HojeTab({ userId, date }: Props) {
  const supabase = await createClient();

  const [mealsRes, foodsRes] = await Promise.all([
    supabase
      .from("meals")
      .select("id, meal_type, notes")
      .eq("user_id", userId)
      .eq("occurred_on", date),
    supabase
      .from("foods")
      .select("id, name, kcal_per_100g, protein_g, carb_g, fat_g, fiber_g, serving_g")
      .eq("user_id", userId)
      .order("name"),
  ]);

  const meals = (mealsRes.data ?? []) as MealRow[];
  const foods = (foodsRes.data ?? []) as Food[];
  const foodMap = new Map(foods.map((f) => [f.id, f]));

  const mealIds = meals.map((m) => m.id);
  const { data: itemsRaw } =
    mealIds.length > 0
      ? await supabase
          .from("meal_items")
          .select("id, meal_id, food_id, grams")
          .in("meal_id", mealIds)
      : { data: [] as ItemRow[] };
  const items = (itemsRaw ?? []) as ItemRow[];

  // Index meal_id → items
  const itemsByMeal = new Map<string, ItemRow[]>();
  for (const it of items) {
    const arr = itemsByMeal.get(it.meal_id) ?? [];
    arr.push(it);
    itemsByMeal.set(it.meal_id, arr);
  }

  // Compute totais do dia
  const allMacros: Macros[] = [];
  for (const it of items) {
    const f = foodMap.get(it.food_id);
    if (f) allMacros.push(macrosFor(f, it.grams));
  }
  const dayTotal = allMacros.length > 0 ? sumMacros(allMacros) : ZERO_MACROS;

  // Order meals by MEAL_TYPE_ORDER
  const mealsByType = new Map(meals.map((m) => [m.meal_type, m]));

  const today = todayBRTISO();
  const isToday = date === today;
  const prev = addDaysISO(date, -1);
  const next = addDaysISO(date, 1);
  const isFuture = next > today;

  if (foods.length === 0) {
    return (
      <GlassCard>
        <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
          Você ainda não tem alimentos cadastrados. Vá pra <strong>Alimentos</strong> e clique em
          "Carregar TACO" pra começar com ~38 alimentos comuns em PT-BR.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="grid gap-4">
      <GlassCard>
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/dieta?t=hoje&d=${prev}`}
            className="rounded px-2 py-1 text-sm transition hover:opacity-80"
            style={{ background: "var(--color-card)" }}
            aria-label="Dia anterior"
          >
            ←
          </Link>
          <div className="text-center">
            <div className="text-sm font-semibold capitalize">{dayLabelBR(date)}</div>
            {isToday ? (
              <span
                className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white"
                style={{ background: "var(--gradient-brand)" }}
              >
                hoje
              </span>
            ) : null}
          </div>
          {isFuture ? (
            <span
              className="rounded px-2 py-1 text-sm opacity-40"
              style={{ background: "var(--color-card)" }}
            >
              →
            </span>
          ) : (
            <Link
              href={`/dieta?t=hoje&d=${next}`}
              className="rounded px-2 py-1 text-sm transition hover:opacity-80"
              style={{ background: "var(--color-card)" }}
              aria-label="Próximo dia"
            >
              →
            </Link>
          )}
        </div>
        <div className="mt-4">
          <MacrosBar macros={dayTotal} />
        </div>
      </GlassCard>

      {MEAL_TYPE_ORDER.map((mt) => {
        const meal = mealsByType.get(mt);
        const itemsForMeal = meal ? (itemsByMeal.get(meal.id) ?? []) : [];
        const enriched = itemsForMeal
          .map((it) => {
            const food = foodMap.get(it.food_id);
            if (!food) return null;
            return {
              id: it.id,
              food_id: it.food_id,
              foodName: food.name,
              grams: it.grams,
              macros: macrosFor(food, it.grams),
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);

        return (
          <MealCard
            key={mt}
            mealType={mt}
            label={MEAL_TYPE_LABELS[mt]}
            icon={MEAL_TYPE_ICONS[mt]}
            mealId={meal?.id ?? null}
            mealNotes={meal?.notes ?? ""}
            items={enriched}
            occurredOn={date}
            foods={foods}
          />
        );
      })}
    </div>
  );
}
