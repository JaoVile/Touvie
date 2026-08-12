import { todayBRTISO } from "@/lib/datetime";
import type { ToubeCtx } from "@/lib/toube-ctx";
import { z } from "zod";

export const logSchema = z.object({
  session_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  set_number: z.number().int().min(1).max(50),
  reps: z.number().int().min(0).max(200).nullable(),
  weight_kg: z.number().min(0).max(1000).nullable(),
  rpe: z.number().int().min(1).max(10).nullable(),
});

export function parseFloatOrNull(v: string | undefined | null): number | null {
  if (!v) return null;
  const n = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseIntOrNull(v: string | undefined | null): number | null {
  if (!v) return null;
  return /^\d+$/.test(v) ? Number.parseInt(v, 10) : null;
}

/** Reaproveita a sessão de hoje se existir; senão abre uma. */
export async function startSessionCore(
  ctx: ToubeCtx,
  programDayId: string | null,
): Promise<{ ok?: boolean; error?: string; sessionId?: string }> {
  const today = todayBRTISO();
  const { data: existing } = await ctx.supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("occurred_on", today)
    .maybeSingle();
  if (existing) return { ok: true, sessionId: existing.id };

  const { data, error } = await ctx.supabase
    .from("workout_sessions")
    .insert({ user_id: ctx.userId, occurred_on: today, program_day_id: programDayId })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { ok: true, sessionId: data.id };
}

export async function saveLogCore(
  ctx: ToubeCtx,
  input: {
    id?: string;
    session_id: string;
    exercise_id: string;
    set_number: number;
    reps: string;
    weight_kg: string;
    rpe: string;
  },
): Promise<{ ok?: boolean; error?: string; id?: string }> {
  const parsed = logSchema.safeParse({
    session_id: input.session_id,
    exercise_id: input.exercise_id,
    set_number: input.set_number,
    reps: parseIntOrNull(input.reps),
    weight_kg: parseFloatOrNull(input.weight_kg),
    rpe: parseIntOrNull(input.rpe),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const payload = {
    user_id: ctx.userId,
    session_id: parsed.data.session_id,
    exercise_id: parsed.data.exercise_id,
    set_number: parsed.data.set_number,
    reps: parsed.data.reps,
    weight_kg: parsed.data.weight_kg,
    rpe: parsed.data.rpe,
  };
  if (input.id) {
    const { error } = await ctx.supabase
      .from("exercise_logs")
      .update(payload)
      .eq("id", input.id)
      .eq("user_id", ctx.userId);
    if (error) return { error: error.message };
    return { ok: true, id: input.id };
  }
  const { data, error } = await ctx.supabase
    .from("exercise_logs")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { ok: true, id: data.id };
}

/**
 * Loga UMA série pelo Toube: reusa/abre a sessão de hoje, calcula o próximo
 * número de série pra esse exercício na sessão e grava. O `exercise_id` precisa
 * já existir no catálogo.
 */
export async function logQuickSetCore(
  ctx: ToubeCtx,
  input: { exercise_id: string; reps: string; weight_kg: string; rpe?: string },
): Promise<{ ok?: boolean; error?: string }> {
  const session = await startSessionCore(ctx, null);
  if (session.error || !session.sessionId) {
    return { error: session.error ?? "Não consegui abrir a sessão de hoje." };
  }
  const { count } = await ctx.supabase
    .from("exercise_logs")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.sessionId)
    .eq("exercise_id", input.exercise_id)
    .eq("user_id", ctx.userId);
  const res = await saveLogCore(ctx, {
    session_id: session.sessionId,
    exercise_id: input.exercise_id,
    set_number: (count ?? 0) + 1,
    reps: input.reps,
    weight_kg: input.weight_kg,
    rpe: input.rpe ?? "",
  });
  return res.error ? { error: res.error } : { ok: true };
}
