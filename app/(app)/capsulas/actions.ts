"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const TITLE_MAX = 80;
// Teto folgado: uma carta cifrada (enc:v1:) infla ~1.4x sobre o texto puro.
const CONTENT_MAX = 200_000;
const MAX_YEARS = 50;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, userId: user.id };
}

/**
 * Sela uma cápsula. O content chega do navegador já do jeito que vai ficar:
 * cifrado (enc:v1:, DEK do diário) ou texto puro — o servidor não decide nem
 * inspeciona, só valida tamanhos e a data.
 */
export async function sealCapsule(input: {
  title: string;
  content: string;
  opensAt: string;
}): Promise<{ error?: string; ok?: boolean }> {
  const { supabase, userId } = await requireUser();

  const title = (input.title ?? "").trim().slice(0, TITLE_MAX);
  const content = input.content ?? "";
  if (!content.trim()) return { error: "A carta está vazia." };
  if (content.length > CONTENT_MAX) return { error: "A carta é longa demais." };

  const opens = new Date(input.opensAt);
  if (Number.isNaN(opens.getTime())) return { error: "Data inválida." };
  const now = Date.now();
  if (opens.getTime() <= now + 60_000) return { error: "A data precisa estar no futuro." };
  if (opens.getTime() > now + MAX_YEARS * 365 * 86_400_000) {
    return { error: `No máximo ${MAX_YEARS} anos — o universo tem limites.` };
  }

  const { error } = await supabase.from("time_capsules").insert({
    user_id: userId,
    title,
    content,
    opens_at: opens.toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath("/capsulas");
  return { ok: true };
}

/** Marca como aberta (só depois de opens_at — o SQL reforça a trava). */
export async function openCapsule(id: string): Promise<{ error?: string; ok?: boolean }> {
  const { supabase, userId } = await requireUser();
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("time_capsules")
    .update({ opened_at: nowIso, updated_at: nowIso })
    .eq("id", id)
    .eq("user_id", userId)
    .is("opened_at", null)
    .lte("opens_at", nowIso);
  if (error) return { error: error.message };
  revalidatePath("/capsulas");
  return { ok: true };
}

/**
 * Exclui uma cápsula que JÁ CHEGOU (opens_at no passado). Cápsula viajando não
 * se apaga — depois de jogar pro universo, ela só volta quando for a hora.
 */
export async function deleteCapsule(id: string): Promise<{ error?: string; ok?: boolean }> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("time_capsules")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .lte("opens_at", new Date().toISOString());
  if (error) return { error: error.message };
  revalidatePath("/capsulas");
  return { ok: true };
}
