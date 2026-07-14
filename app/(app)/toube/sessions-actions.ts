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

const isUuid = (v: string) => z.string().uuid().safeParse(v).success;

export async function createSession(): Promise<{ id: string }> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("toube_sessions")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Erro ao criar conversa");
  revalidatePath("/toube");
  return { id: data.id };
}

export async function renameSession(
  id: string,
  title: string,
): Promise<{ ok?: boolean; error?: string }> {
  if (!isUuid(id)) return { error: "id inválido." };
  const t = title.trim().slice(0, 120);
  if (!t) return { error: "Título vazio." };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("toube_sessions")
    .update({ title: t })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/toube");
  return { ok: true };
}

export async function deleteSession(id: string): Promise<{ ok?: boolean; error?: string }> {
  if (!isUuid(id)) return { error: "id inválido." };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("toube_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/toube");
  return { ok: true };
}

export async function listSessions(): Promise<
  { id: string; title: string | null; updated_at: string }[]
> {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase
    .from("toube_sessions")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
