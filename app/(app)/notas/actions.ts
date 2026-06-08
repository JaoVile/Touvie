"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, userId: user.id };
}

export async function createNote(): Promise<never> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("notes")
    .insert({ user_id: userId, title: "", content: "" })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Erro ao criar nota");
  redirect(`/notas/${data.id}`);
}

const noteSchema = z.object({
  title: z.string().max(200),
  content: z.string().max(100_000),
  tags: z.string().max(500),
});

export async function saveNote(
  id: string,
  input: { title: string; content: string; tags: string },
): Promise<{ ok?: boolean; error?: string; saved_at?: string }> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  const { supabase, userId } = await requireUser();
  const tags = parsed.data.tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const { error } = await supabase
    .from("notes")
    .update({ title: parsed.data.title, content: parsed.data.content, tags })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/notas");
  return { ok: true, saved_at: new Date().toISOString() };
}

export async function togglePin(id: string, pinned: boolean): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase.from("notes").update({ pinned }).eq("id", id).eq("user_id", userId);
  revalidatePath("/notas");
}

export async function deleteNote(id: string): Promise<never> {
  const { supabase, userId } = await requireUser();
  await supabase.from("notes").delete().eq("id", id).eq("user_id", userId);
  redirect("/notas");
}
