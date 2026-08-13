"use server";

import { saveMeasurementCore } from "@/app/(app)/dieta/core";
import { TACO_SEED } from "@/lib/diet";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, userId: user.id };
}

// --- TACO SEED -----------------------------------------------------

export async function seedTacoFoods(): Promise<{ ok?: boolean; error?: string; count?: number }> {
  const { supabase, userId } = await requireUser();
  const { data: existing } = await supabase
    .from("foods")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  if (existing && existing.length > 0) return { error: "Você já tem alimentos cadastrados" };

  const rows = TACO_SEED.map((f) => ({ user_id: userId, ...f }));
  const { error } = await supabase.from("foods").insert(rows);
  if (error) return { error: error.message };
  revalidatePath("/dieta");
  return { ok: true, count: rows.length };
}

// --- FOODS ---------------------------------------------------------

const foodSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  kcal_per_100g: z.number().min(0).max(2000),
  protein_g: z.number().min(0).max(200),
  carb_g: z.number().min(0).max(200),
  fat_g: z.number().min(0).max(200),
  fiber_g: z.number().min(0).max(200),
  serving_g: z.number().min(0).max(2000).nullable(),
});

function parseNum(v: string | undefined | null): number {
  if (!v) return 0;
  const n = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function parseNumOrNull(v: string | undefined | null): number | null {
  if (!v) return null;
  const n = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function saveFood(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const parsed = foodSchema.safeParse({
    id: fd.get("id")?.toString() || undefined,
    name: fd.get("name")?.toString(),
    kcal_per_100g: parseNum(fd.get("kcal_per_100g")?.toString()),
    protein_g: parseNum(fd.get("protein_g")?.toString()),
    carb_g: parseNum(fd.get("carb_g")?.toString()),
    fat_g: parseNum(fd.get("fat_g")?.toString()),
    fiber_g: parseNum(fd.get("fiber_g")?.toString()),
    serving_g: parseNumOrNull(fd.get("serving_g")?.toString()),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const { supabase, userId } = await requireUser();
  const { id, ...fields } = parsed.data;
  const payload = { user_id: userId, ...fields };
  const { error } = id
    ? await supabase.from("foods").update(payload).eq("id", id)
    : await supabase.from("foods").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/dieta");
  return { ok: true };
}

export async function deleteFood(id: string): Promise<{ ok?: boolean; error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("foods").delete().eq("id", id);
  if (error) {
    return { error: "Não dá pra apagar — esse alimento aparece em refeições passadas." };
  }
  revalidatePath("/dieta");
  return { ok: true };
}

// --- MEAL ITEMS (cria meal automaticamente se faltar) -------------

const mealItemSchema = z.object({
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal_type: z.enum(["breakfast", "lunch", "snack", "dinner", "pre", "post", "other"]),
  food_id: z.string().uuid(),
  grams: z.number().positive().max(5000),
});

export async function addMealItem(input: {
  occurred_on: string;
  meal_type: string;
  food_id: string;
  grams: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const parsed = mealItemSchema.safeParse({
    occurred_on: input.occurred_on,
    meal_type: input.meal_type,
    food_id: input.food_id,
    grams: parseNum(input.grams),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const { supabase, userId } = await requireUser();

  // Localiza ou cria meal
  const { data: existingMeal } = await supabase
    .from("meals")
    .select("id")
    .eq("user_id", userId)
    .eq("occurred_on", parsed.data.occurred_on)
    .eq("meal_type", parsed.data.meal_type)
    .maybeSingle();

  let mealId = existingMeal?.id;
  if (!mealId) {
    const { data: created, error } = await supabase
      .from("meals")
      .insert({
        user_id: userId,
        occurred_on: parsed.data.occurred_on,
        meal_type: parsed.data.meal_type,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    mealId = created.id;
  }

  const { error: itemError } = await supabase.from("meal_items").insert({
    user_id: userId,
    meal_id: mealId,
    food_id: parsed.data.food_id,
    grams: parsed.data.grams,
  });
  if (itemError) return { error: itemError.message };

  revalidatePath("/dieta");
  return { ok: true };
}

export async function deleteMealItem(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("meal_items").delete().eq("id", id);
  revalidatePath("/dieta");
}

export async function deleteMeal(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("meals").delete().eq("id", id);
  revalidatePath("/dieta");
}

export async function updateMealNotes(id: string, notes: string) {
  const { supabase } = await requireUser();
  await supabase
    .from("meals")
    .update({ notes: notes || null })
    .eq("id", id);
  revalidatePath("/dieta");
}

// --- BODY MEASUREMENTS --------------------------------------------

export async function saveMeasurement(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await requireUser();
  const res = await saveMeasurementCore(ctx, {
    id: fd.get("id")?.toString() || undefined,
    measured_on: fd.get("measured_on")?.toString(),
    weight_kg: parseNumOrNull(fd.get("weight_kg")?.toString()),
    waist_cm: parseNumOrNull(fd.get("waist_cm")?.toString()),
    chest_cm: parseNumOrNull(fd.get("chest_cm")?.toString()),
    arm_cm: parseNumOrNull(fd.get("arm_cm")?.toString()),
    thigh_cm: parseNumOrNull(fd.get("thigh_cm")?.toString()),
    bodyfat_pct: parseNumOrNull(fd.get("bodyfat_pct")?.toString()),
    notes: fd.get("notes")?.toString() || null,
  });
  if (res.error) return { error: res.error };
  revalidatePath("/dieta");
  return { ok: true };
}

export async function deleteMeasurement(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("body_measurements").delete().eq("id", id);
  revalidatePath("/dieta");
}
