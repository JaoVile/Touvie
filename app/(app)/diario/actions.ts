"use server";

import { TRUSTED_COOKIE, verifyTrustedDevice } from "@/lib/device";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { z } from "zod";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, userId: user.id };
}

/**
 * A escrita exige um dispositivo confiável (cookie `rotina_edit`), liberado pelo
 * código de acesso no /config. Defesa server-side: o `editable` do editor é só
 * client-side, então sem este check quem tem só o PIN de leitura escreveria.
 */
async function isTrustedDevice(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyTrustedDevice(cookieStore.get(TRUSTED_COOKIE)?.value, userId);
}

const entrySchema = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Semana inválida"),
  content: z.string().max(50_000, "Texto muito longo"),
});

export async function saveEntry(input: {
  week_start: string;
  content: string;
}): Promise<{ error?: string; ok?: boolean; saved_at?: string }> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  const { supabase, userId } = await requireUser();
  if (!(await isTrustedDevice(userId))) return { error: "Somente leitura." };
  const now = new Date().toISOString();
  const { error } = await supabase.from("journal_entries").upsert(
    {
      user_id: userId,
      week_start: parsed.data.week_start,
      content: parsed.data.content,
      updated_at: now,
    },
    { onConflict: "user_id,week_start" },
  );
  if (error) return { error: error.message };

  return { ok: true, saved_at: now };
}

const moodSchema = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Semana inválida"),
  mood_score: z.number().int().min(1).max(5),
  mood_emoji: z.string().max(8),
});

export async function saveMood(input: {
  week_start: string;
  mood_score: number;
  mood_emoji: string;
}): Promise<{ error?: string; ok?: boolean }> {
  const parsed = moodSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  const { supabase, userId } = await requireUser();
  if (!(await isTrustedDevice(userId))) return { error: "Somente leitura." };
  const { error } = await supabase.from("journal_entries").upsert(
    {
      user_id: userId,
      week_start: parsed.data.week_start,
      mood_score: parsed.data.mood_score,
      mood_emoji: parsed.data.mood_emoji,
    },
    { onConflict: "user_id,week_start" },
  );
  if (error) return { error: error.message };
  return { ok: true };
}
