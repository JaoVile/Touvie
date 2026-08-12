"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  deleteGoalCore,
  deleteTaskCore,
  saveGoalCore,
  saveTaskCore,
  setGoalStatusCore,
  toggleTaskDoneCore,
} from "./core";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, userId: user.id };
}

function revalidate() {
  revalidatePath("/metas");
  revalidatePath("/");
}

export async function saveGoal(fd: FormData) {
  const ctx = await requireUser();
  const res = await saveGoalCore(ctx, {
    id: fd.get("id")?.toString() || undefined,
    title: fd.get("title")?.toString(),
    description: fd.get("description")?.toString() || null,
    target_date: fd.get("target_date")?.toString() || null,
    parent_goal_id: fd.get("parent_goal_id")?.toString() || null,
  });
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

export async function setGoalStatus(id: string, status: "active" | "done" | "paused" | "dropped") {
  await setGoalStatusCore(await requireUser(), id, status);
  revalidate();
}

export async function deleteGoal(id: string) {
  await deleteGoalCore(await requireUser(), id);
  revalidate();
}

export async function saveTask(fd: FormData) {
  const ctx = await requireUser();
  const res = await saveTaskCore(ctx, {
    id: fd.get("id")?.toString() || undefined,
    title: fd.get("title")?.toString(),
    notes: fd.get("notes")?.toString() || null,
    due_date: fd.get("due_date")?.toString() || null,
    goal_id: fd.get("goal_id")?.toString() || null,
    priority: fd.get("priority") ?? 0,
  });
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

export async function toggleTaskDone(id: string, done: boolean) {
  await toggleTaskDoneCore(await requireUser(), id, done);
  revalidate();
}

export async function deleteTask(id: string) {
  await deleteTaskCore(await requireUser(), id);
  revalidate();
}
