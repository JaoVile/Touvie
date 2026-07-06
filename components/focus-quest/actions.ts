"use server";

import { startOfTodayBRTUTC } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export type QuestRow = {
  id: string;
  text: string;
  prompt: string;
  started_at: string;
  completed_at: string | null;
};

const COLS = "id, text, prompt, started_at, completed_at";
const MAX_LEN = 280;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, userId: user.id };
}

/** Quest do usuário cujo started_at cai no dia BRT de hoje (a mais recente). */
export async function todayQuest(): Promise<QuestRow | null> {
  try {
    const { supabase, userId } = await requireUser();
    const { data } = await supabase
      .from("focus_quests")
      .select(COLS)
      .eq("user_id", userId)
      .gte("started_at", startOfTodayBRTUTC())
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as QuestRow | null) ?? null;
  } catch {
    return null;
  }
}

export async function createQuest(
  text: string,
  prompt: string,
): Promise<{ ok: boolean; quest?: QuestRow; error?: string }> {
  const clean = text.trim();
  if (!clean) return { ok: false, error: "Escreva seu foco primeiro." };
  if (clean.length > MAX_LEN) return { ok: false, error: "Foco muito longo." };
  try {
    const { supabase, userId } = await requireUser();

    // Guarda anti-duplicata: se já há quest hoje, devolve a existente.
    const existing = await todayQuest();
    if (existing) return { ok: true, quest: existing };

    const { data, error } = await supabase
      .from("focus_quests")
      .insert({ user_id: userId, text: clean, prompt })
      .select(COLS)
      .single();
    if (error) {
      return {
        ok: false,
        error: error.message.includes("focus_quests")
          ? "Aplique a migração 0025 no Supabase primeiro."
          : error.message,
      };
    }
    return { ok: true, quest: data as QuestRow };
  } catch {
    return { ok: false, error: "Não consegui salvar." };
  }
}

export async function completeQuest(
  id: string,
): Promise<{ ok: boolean; quest?: QuestRow; error?: string }> {
  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from("focus_quests")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .is("completed_at", null)
      .select(COLS)
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, quest: data as QuestRow };
  } catch {
    return { ok: false, error: "Falhou." };
  }
}

export async function discardQuest(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("focus_quests")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Falhou." };
  }
}

export async function setFocusQuestEnabled(
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("profiles")
      .update({ focus_quest_enabled: enabled })
      .eq("id", userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Falhou." };
  }
}
