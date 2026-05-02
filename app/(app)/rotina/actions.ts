"use server";

import { todayBRTISO } from "@/lib/datetime";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, userId: user.id };
}

const dailySchema = z.object({
  id: z.string().uuid().optional(),
  time_slot: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida (use HH:MM)"),
  title: z.string().min(1, "Título obrigatório").max(120),
  emoji: z.string().max(8).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const weeklySchema = z.object({
  id: z.string().uuid().optional(),
  weekday: z.coerce.number().int().min(0).max(6),
  block: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  emoji: z.string().max(8).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

function parseFormDaily(fd: FormData) {
  return dailySchema.safeParse({
    id: fd.get("id")?.toString() || undefined,
    time_slot: fd.get("time_slot")?.toString(),
    title: fd.get("title")?.toString(),
    emoji: fd.get("emoji")?.toString() || null,
    notes: fd.get("notes")?.toString() || null,
  });
}

function parseFormWeekly(fd: FormData) {
  return weeklySchema.safeParse({
    id: fd.get("id")?.toString() || undefined,
    weekday: fd.get("weekday"),
    block: fd.get("block")?.toString(),
    title: fd.get("title")?.toString(),
    emoji: fd.get("emoji")?.toString() || null,
    notes: fd.get("notes")?.toString() || null,
  });
}

export async function saveDailyBlock(fd: FormData) {
  const parsed = parseFormDaily(fd);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const { supabase, userId } = await requireUser();
  const payload = {
    user_id: userId,
    time_slot: `${parsed.data.time_slot}:00`,
    title: parsed.data.title,
    emoji: parsed.data.emoji || null,
    notes: parsed.data.notes || null,
  };
  if (parsed.data.id) {
    await supabase.from("routine_daily").update(payload).eq("id", parsed.data.id);
  } else {
    await supabase.from("routine_daily").insert(payload);
  }
  revalidatePath("/rotina");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteDailyBlock(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("routine_daily").delete().eq("id", id);
  revalidatePath("/rotina");
  revalidatePath("/");
}

export async function saveWeeklyBlock(fd: FormData) {
  const parsed = parseFormWeekly(fd);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const { supabase, userId } = await requireUser();
  const payload = {
    user_id: userId,
    weekday: parsed.data.weekday,
    block: parsed.data.block,
    title: parsed.data.title,
    emoji: parsed.data.emoji || null,
    notes: parsed.data.notes || null,
  };
  if (parsed.data.id) {
    await supabase.from("routine_weekly").update(payload).eq("id", parsed.data.id);
  } else {
    await supabase.from("routine_weekly").insert(payload);
  }
  revalidatePath("/rotina");
  return { ok: true };
}

export async function deleteWeeklyBlock(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("routine_weekly").delete().eq("id", id);
  revalidatePath("/rotina");
}

export async function toggleCompletion(
  routineId: string,
  completedOn: string = todayBRTISO(),
): Promise<{ completed: boolean }> {
  const { supabase, userId } = await requireUser();

  const { data: existing } = await supabase
    .from("routine_completions")
    .select("id")
    .eq("user_id", userId)
    .eq("routine_id", routineId)
    .eq("completed_on", completedOn)
    .maybeSingle();

  if (existing) {
    await supabase.from("routine_completions").delete().eq("id", existing.id);
    revalidatePath("/rotina");
    revalidatePath("/");
    return { completed: false };
  }

  await supabase.from("routine_completions").insert({ user_id: userId, routine_id: routineId, completed_on: completedOn });
  revalidatePath("/rotina");
  revalidatePath("/");
  return { completed: true };
}
