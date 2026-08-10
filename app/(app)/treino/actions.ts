"use server";

import { todayBRTISO } from "@/lib/datetime";
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

// --- PROGRAMS ------------------------------------------------------

const programSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Nome obrigatório").max(80),
});

export async function saveProgram(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const parsed = programSchema.safeParse({
    id: fd.get("id")?.toString() || undefined,
    name: fd.get("name")?.toString(),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const { supabase, userId } = await requireUser();
  const payload = { user_id: userId, name: parsed.data.name };
  const { error } = parsed.data.id
    ? await supabase.from("workout_programs").update(payload).eq("id", parsed.data.id)
    : await supabase.from("workout_programs").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/treino");
  return { ok: true };
}

export async function deleteProgram(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("workout_programs").delete().eq("id", id);
  revalidatePath("/treino");
}

export async function setActiveProgram(id: string) {
  const { supabase, userId } = await requireUser();
  // Apenas um programa ativo por vez
  await supabase.from("workout_programs").update({ active: false }).eq("user_id", userId);
  await supabase.from("workout_programs").update({ active: true }).eq("id", id);
  revalidatePath("/treino");
}

// --- PROGRAM DAYS --------------------------------------------------

const daySchema = z.object({
  id: z.string().uuid().optional(),
  program_id: z.string().uuid(),
  weekday: z.coerce.number().int().min(0).max(6),
  name: z.string().min(1).max(60),
});

export async function saveProgramDay(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const parsed = daySchema.safeParse({
    id: fd.get("id")?.toString() || undefined,
    program_id: fd.get("program_id")?.toString(),
    weekday: fd.get("weekday"),
    name: fd.get("name")?.toString(),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const { supabase, userId } = await requireUser();
  const payload = {
    user_id: userId,
    program_id: parsed.data.program_id,
    weekday: parsed.data.weekday,
    name: parsed.data.name,
  };
  const { error } = parsed.data.id
    ? await supabase.from("workout_days").update(payload).eq("id", parsed.data.id)
    : await supabase.from("workout_days").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/treino");
  return { ok: true };
}

export async function deleteProgramDay(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("workout_days").delete().eq("id", id);
  revalidatePath("/treino");
}

// --- EXERCISES (catalog) -------------------------------------------

const exerciseSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  muscle_group: z.string().max(40).nullable(),
  notes: z.string().max(500).nullable(),
});

export async function saveExercise(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const parsed = exerciseSchema.safeParse({
    id: fd.get("id")?.toString() || undefined,
    name: fd.get("name")?.toString(),
    muscle_group: fd.get("muscle_group")?.toString() || null,
    notes: fd.get("notes")?.toString() || null,
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const { supabase, userId } = await requireUser();
  const payload = {
    user_id: userId,
    name: parsed.data.name,
    muscle_group: parsed.data.muscle_group,
    notes: parsed.data.notes,
  };
  const { error } = parsed.data.id
    ? await supabase.from("exercises").update(payload).eq("id", parsed.data.id)
    : await supabase.from("exercises").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/treino");
  return { ok: true };
}

export async function deleteExercise(id: string): Promise<{ ok?: boolean; error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("exercises").delete().eq("id", id);
  if (error) {
    return {
      error: "Não dá pra apagar — esse exercício tem séries logadas. Renomeie no lugar.",
    };
  }
  revalidatePath("/treino");
  return { ok: true };
}

// --- DAY EXERCISES (junction) --------------------------------------

const dayExerciseSchema = z.object({
  id: z.string().uuid().optional(),
  program_day_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  target_sets: z.number().int().min(1).max(20).nullable(),
  target_reps_low: z.number().int().min(1).max(50).nullable(),
  target_reps_high: z.number().int().min(1).max(50).nullable(),
  notes: z.string().max(200).nullable(),
});

export async function saveDayExercise(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const toInt = (k: string) => {
    const v = fd.get(k)?.toString() ?? "";
    return /^\d+$/.test(v) ? Number.parseInt(v, 10) : null;
  };
  const parsed = dayExerciseSchema.safeParse({
    id: fd.get("id")?.toString() || undefined,
    program_day_id: fd.get("program_day_id")?.toString(),
    exercise_id: fd.get("exercise_id")?.toString(),
    target_sets: toInt("target_sets"),
    target_reps_low: toInt("target_reps_low"),
    target_reps_high: toInt("target_reps_high"),
    notes: fd.get("notes")?.toString() || null,
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const { supabase, userId } = await requireUser();
  const payload = {
    user_id: userId,
    program_day_id: parsed.data.program_day_id,
    exercise_id: parsed.data.exercise_id,
    target_sets: parsed.data.target_sets,
    target_reps_low: parsed.data.target_reps_low,
    target_reps_high: parsed.data.target_reps_high,
    notes: parsed.data.notes,
  };

  if (parsed.data.id) {
    await supabase.from("workout_day_exercises").update(payload).eq("id", parsed.data.id);
  } else {
    // Pega max sort_order pra adicionar no fim
    const { data: existing } = await supabase
      .from("workout_day_exercises")
      .select("sort_order")
      .eq("program_day_id", parsed.data.program_day_id)
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;
    await supabase.from("workout_day_exercises").insert({ ...payload, sort_order: nextOrder });
  }
  revalidatePath("/treino");
  return { ok: true };
}

export async function removeDayExercise(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("workout_day_exercises").delete().eq("id", id);
  revalidatePath("/treino");
}

export async function reorderDayExercise(id: string, direction: -1 | 1) {
  const { supabase, userId } = await requireUser();
  const { data: row } = await supabase
    .from("workout_day_exercises")
    .select("id, program_day_id, sort_order")
    .eq("id", id)
    .maybeSingle();
  if (!row) return;

  const targetOrder = row.sort_order + direction;
  const { data: neighbor } = await supabase
    .from("workout_day_exercises")
    .select("id, sort_order")
    .eq("user_id", userId)
    .eq("program_day_id", row.program_day_id)
    .eq("sort_order", targetOrder)
    .maybeSingle();
  if (!neighbor) return;

  await supabase
    .from("workout_day_exercises")
    .update({ sort_order: row.sort_order })
    .eq("id", neighbor.id);
  await supabase.from("workout_day_exercises").update({ sort_order: targetOrder }).eq("id", row.id);
  revalidatePath("/treino");
}

// --- SESSIONS ------------------------------------------------------

export async function startSession(programDayId: string | null): Promise<{
  ok?: boolean;
  error?: string;
  sessionId?: string;
}> {
  const { supabase, userId } = await requireUser();
  const today = todayBRTISO();

  // Reaproveita sessão de hoje se já existe
  const { data: existing } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("occurred_on", today)
    .maybeSingle();
  if (existing) {
    revalidatePath("/treino");
    return { ok: true, sessionId: existing.id };
  }

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({ user_id: userId, occurred_on: today, program_day_id: programDayId })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/treino");
  return { ok: true, sessionId: data.id };
}

export async function deleteSession(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("workout_sessions").delete().eq("id", id);
  revalidatePath("/treino");
}

/** Fecha a sessão. `completed_at` nulo = em andamento (ver migration 0038). */
export async function completeSession(id: string): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("workout_sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/treino");
  return { ok: true };
}

/** Desfaz a conclusão — erro de clique não deve custar a sessão inteira. */
export async function reopenSession(id: string): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("workout_sessions")
    .update({ completed_at: null })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/treino");
  return { ok: true };
}

export async function updateSessionNotes(id: string, notes: string) {
  const { supabase } = await requireUser();
  await supabase
    .from("workout_sessions")
    .update({ notes: notes || null })
    .eq("id", id);
  revalidatePath("/treino");
}

// --- LOGS (sets) ---------------------------------------------------

const logSchema = z.object({
  session_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  set_number: z.number().int().min(1).max(50),
  reps: z.number().int().min(0).max(200).nullable(),
  weight_kg: z.number().min(0).max(1000).nullable(),
  rpe: z.number().int().min(1).max(10).nullable(),
});

function parseFloatOrNull(v: string | undefined | null): number | null {
  if (!v) return null;
  const cleaned = v.replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseIntOrNull(v: string | undefined | null): number | null {
  if (!v) return null;
  return /^\d+$/.test(v) ? Number.parseInt(v, 10) : null;
}

export async function saveLog(input: {
  id?: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  reps: string;
  weight_kg: string;
  rpe: string;
}): Promise<{ ok?: boolean; error?: string; id?: string }> {
  const parsed = logSchema.safeParse({
    session_id: input.session_id,
    exercise_id: input.exercise_id,
    set_number: input.set_number,
    reps: parseIntOrNull(input.reps),
    weight_kg: parseFloatOrNull(input.weight_kg),
    rpe: parseIntOrNull(input.rpe),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const { supabase, userId } = await requireUser();
  const payload = {
    user_id: userId,
    session_id: parsed.data.session_id,
    exercise_id: parsed.data.exercise_id,
    set_number: parsed.data.set_number,
    reps: parsed.data.reps,
    weight_kg: parsed.data.weight_kg,
    rpe: parsed.data.rpe,
  };
  if (input.id) {
    const { error } = await supabase.from("exercise_logs").update(payload).eq("id", input.id);
    if (error) return { error: error.message };
    return { ok: true, id: input.id };
  }
  const { data, error } = await supabase
    .from("exercise_logs")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/treino");
  return { ok: true, id: data.id };
}

/**
 * Loga UMA série pelo Toube: reusa/abre a sessão de hoje, calcula o próximo
 * número de série pra esse exercício na sessão e grava. O exercício precisa já
 * existir no catálogo (o `exercise_id` vem do contexto do agente, casado por nome).
 */
export async function logQuickSet(input: {
  exercise_id: string;
  reps: string;
  weight_kg: string;
  rpe?: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const session = await startSession(null);
  if (session.error || !session.sessionId) {
    return { error: session.error ?? "Não consegui abrir a sessão de hoje." };
  }
  const { supabase } = await requireUser();
  const { count } = await supabase
    .from("exercise_logs")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.sessionId)
    .eq("exercise_id", input.exercise_id);
  const res = await saveLog({
    session_id: session.sessionId,
    exercise_id: input.exercise_id,
    set_number: (count ?? 0) + 1,
    reps: input.reps,
    weight_kg: input.weight_kg,
    rpe: input.rpe ?? "",
  });
  return res?.error ? { error: res.error } : { ok: true };
}

export async function deleteLog(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("exercise_logs").delete().eq("id", id);
  revalidatePath("/treino");
}
