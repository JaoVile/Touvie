"use server";

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

const goalSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  target_date: z.string().optional().nullable(),
  parent_goal_id: z.string().uuid().optional().nullable(),
});

const taskSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  notes: z.string().max(500).optional().nullable(),
  due_date: z.string().optional().nullable(),
  goal_id: z.string().uuid().optional().nullable(),
  priority: z.coerce.number().int().min(0).max(3).default(0),
});

export async function saveGoal(fd: FormData) {
  const parsed = goalSchema.safeParse({
    id: fd.get("id")?.toString() || undefined,
    title: fd.get("title")?.toString(),
    description: fd.get("description")?.toString() || null,
    target_date: fd.get("target_date")?.toString() || null,
    parent_goal_id: fd.get("parent_goal_id")?.toString() || null,
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const { supabase, userId } = await requireUser();
  const payload = {
    user_id: userId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    target_date: parsed.data.target_date || null,
    parent_goal_id: parsed.data.parent_goal_id || null,
  };
  if (parsed.data.id) {
    await supabase.from("goals").update(payload).eq("id", parsed.data.id);
  } else {
    await supabase.from("goals").insert(payload);
  }
  revalidatePath("/metas");
  revalidatePath("/");
  return { ok: true };
}

export async function setGoalStatus(id: string, status: "active" | "done" | "paused" | "dropped") {
  const { supabase } = await requireUser();
  await supabase.from("goals").update({ status }).eq("id", id);
  revalidatePath("/metas");
  revalidatePath("/");
}

export async function deleteGoal(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("goals").delete().eq("id", id);
  revalidatePath("/metas");
  revalidatePath("/");
}

export async function saveTask(fd: FormData) {
  const parsed = taskSchema.safeParse({
    id: fd.get("id")?.toString() || undefined,
    title: fd.get("title")?.toString(),
    notes: fd.get("notes")?.toString() || null,
    due_date: fd.get("due_date")?.toString() || null,
    goal_id: fd.get("goal_id")?.toString() || null,
    priority: fd.get("priority") ?? 0,
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const { supabase, userId } = await requireUser();
  const payload = {
    user_id: userId,
    title: parsed.data.title,
    notes: parsed.data.notes || null,
    due_date: parsed.data.due_date || null,
    goal_id: parsed.data.goal_id || null,
    priority: parsed.data.priority,
  };
  if (parsed.data.id) {
    await supabase.from("tasks").update(payload).eq("id", parsed.data.id);
  } else {
    await supabase.from("tasks").insert(payload);
  }
  revalidatePath("/metas");
  revalidatePath("/");
  return { ok: true };
}

export async function toggleTaskDone(id: string, done: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("tasks").update({ done }).eq("id", id);
  revalidatePath("/metas");
  revalidatePath("/");
}

export async function deleteTask(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("tasks").delete().eq("id", id);
  revalidatePath("/metas");
  revalidatePath("/");
}
