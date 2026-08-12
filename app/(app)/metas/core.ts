import type { ToubeCtx } from "@/lib/toube-ctx";
import { z } from "zod";

export const goalSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  target_date: z.string().optional().nullable(),
  parent_goal_id: z.string().uuid().optional().nullable(),
});

export const taskSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  notes: z.string().max(500).optional().nullable(),
  due_date: z.string().optional().nullable(),
  goal_id: z.string().uuid().optional().nullable(),
  priority: z.coerce.number().int().min(0).max(3).default(0),
});

export type CoreResult = { ok?: boolean; error?: string };

export async function saveGoalCore(ctx: ToubeCtx, input: unknown): Promise<CoreResult> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const payload = {
    user_id: ctx.userId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    target_date: parsed.data.target_date || null,
    parent_goal_id: parsed.data.parent_goal_id || null,
  };
  if (parsed.data.id) {
    const { error } = await ctx.supabase
      .from("goals")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("user_id", ctx.userId);
    if (error) return { error: error.message };
  } else {
    const { error } = await ctx.supabase.from("goals").insert(payload);
    if (error) return { error: error.message };
  }
  return { ok: true };
}

export async function setGoalStatusCore(
  ctx: ToubeCtx,
  id: string,
  status: "active" | "done" | "paused" | "dropped",
): Promise<CoreResult> {
  const { error } = await ctx.supabase
    .from("goals")
    .update({ status })
    .eq("id", id)
    .eq("user_id", ctx.userId);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteGoalCore(ctx: ToubeCtx, id: string): Promise<CoreResult> {
  const { error } = await ctx.supabase
    .from("goals")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.userId);
  return error ? { error: error.message } : { ok: true };
}

/** Lê a meta atual pra mesclar campos — `saveGoalCore` exige título, não aceita patch. */
export async function getGoalCore(ctx: ToubeCtx, id: string) {
  const { data } = await ctx.supabase
    .from("goals")
    .select("title, description, target_date")
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  return data;
}

export async function saveTaskCore(ctx: ToubeCtx, input: unknown): Promise<CoreResult> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const payload = {
    user_id: ctx.userId,
    title: parsed.data.title,
    notes: parsed.data.notes || null,
    due_date: parsed.data.due_date || null,
    goal_id: parsed.data.goal_id || null,
    priority: parsed.data.priority,
  };
  if (parsed.data.id) {
    const { error } = await ctx.supabase
      .from("tasks")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("user_id", ctx.userId);
    if (error) return { error: error.message };
  } else {
    const { error } = await ctx.supabase.from("tasks").insert(payload);
    if (error) return { error: error.message };
  }
  return { ok: true };
}

export async function toggleTaskDoneCore(
  ctx: ToubeCtx,
  id: string,
  done: boolean,
): Promise<CoreResult> {
  const { error } = await ctx.supabase
    .from("tasks")
    .update({ done })
    .eq("id", id)
    .eq("user_id", ctx.userId);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteTaskCore(ctx: ToubeCtx, id: string): Promise<CoreResult> {
  const { error } = await ctx.supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.userId);
  return error ? { error: error.message } : { ok: true };
}
