"use server";

import { TRUSTED_COOKIE, verifyTrustedDevice } from "@/lib/device";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

type Wrap = { salt: string; iv: string; ct: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, userId: user.id };
}

async function isTrustedDevice(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyTrustedDevice(cookieStore.get(TRUSTED_COOKIE)?.value, userId);
}

function isWrap(w: unknown): w is Wrap {
  return (
    typeof w === "object" &&
    w !== null &&
    typeof (w as Wrap).salt === "string" &&
    typeof (w as Wrap).iv === "string" &&
    typeof (w as Wrap).ct === "string"
  );
}

/**
 * Liga o diário privado (zero-knowledge). Recebe as 3 "trancas" da DEK (feitas
 * no NAVEGADOR) e as anotações JÁ cifradas. O servidor só guarda blobs — nunca
 * vê PIN, palavra-chave, código, DEK ou texto puro.
 */
export async function activatePrivateDiary(input: {
  pin_wrap: Wrap;
  recovery_wrap: Wrap;
  code_wrap: Wrap;
  entries: { week_start: string; content: string }[];
}): Promise<{ error?: string; ok?: boolean }> {
  const { supabase, userId } = await requireUser();
  if (!(await isTrustedDevice(userId))) {
    return { error: "Ative num dispositivo confiável (o celular fica só leitura)." };
  }
  if (!isWrap(input.pin_wrap) || !isWrap(input.recovery_wrap) || !isWrap(input.code_wrap)) {
    return { error: "Chaves inválidas." };
  }

  // 1) Guarda as 3 trancas da DEK. A existência desta linha = diário privado ON.
  const { error: keysErr } = await supabase.from("diary_keys").upsert(
    {
      user_id: userId,
      pin_wrap: input.pin_wrap,
      recovery_wrap: input.recovery_wrap,
      code_wrap: input.code_wrap,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (keysErr) return { error: keysErr.message };

  // 2) Reescreve as anotações existentes já cifradas (o cliente mandou o
  //    ciphertext). Só entradas que já existem — uma por semana.
  for (const e of input.entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.week_start)) continue;
    const { error } = await supabase
      .from("journal_entries")
      .update({ content: e.content, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("week_start", e.week_start);
    if (error) return { error: error.message };
  }

  revalidatePath("/diario");
  return { ok: true };
}

/**
 * Troca a "tranca" do PIN — re-cifra a DEK com um PIN novo (o cliente já
 * destrancou a DEK e a re-trancou com o PIN novo). Também usado no "esqueci o
 * PIN": entra via palavra-chave/código e define um PIN novo aqui.
 */
export async function updateDiaryPinWrap(
  pin_wrap: Wrap,
): Promise<{ error?: string; ok?: boolean }> {
  const { supabase, userId } = await requireUser();
  if (!(await isTrustedDevice(userId))) {
    return { error: "Ação só em dispositivo confiável." };
  }
  if (!isWrap(pin_wrap)) return { error: "Chave inválida." };
  const { error } = await supabase
    .from("diary_keys")
    .update({ pin_wrap, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/diario");
  return { ok: true };
}

/**
 * Troca a "tranca" do código de recuperação — o cliente gerou um código novo
 * e re-trancou a DEK com ele. O código antigo deixa de destrancar na hora.
 */
export async function updateDiaryCodeWrap(
  code_wrap: Wrap,
): Promise<{ error?: string; ok?: boolean }> {
  const { supabase, userId } = await requireUser();
  if (!(await isTrustedDevice(userId))) {
    return { error: "Ação só em dispositivo confiável." };
  }
  if (!isWrap(code_wrap)) return { error: "Chave inválida." };
  const { error } = await supabase
    .from("diary_keys")
    .update({ code_wrap, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/diario");
  return { ok: true };
}

/**
 * Cápsulas do tempo cifradas (enc:v1:) deste usuário. Usada pelo cliente ao
 * DESLIGAR o diário privado: apagar a DEK sem decifrá-las antes = cartas
 * irrecuperáveis pra sempre. O cliente decifra em memória (sem exibir — a
 * trava de tempo continua) e devolve o texto puro pro deactivate gravar.
 */
export async function listEncryptedCapsules(): Promise<{
  error?: string;
  capsules?: { id: string; content: string }[];
}> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("time_capsules")
    .select("id, content")
    .eq("user_id", userId)
    .like("content", "enc:v1:%");
  if (error) return { error: error.message };
  return { capsules: data ?? [] };
}

/**
 * Desliga o diário privado: grava as anotações — e as cápsulas do tempo que
 * estavam cifradas — de volta em TEXTO PURO (o cliente decifrou tudo com a DEK
 * da sessão) e apaga a linha de chaves. O diário volta a ser aberto/legível.
 */
export async function deactivatePrivateDiary(
  entries: { week_start: string; content: string }[],
  capsules: { id: string; content: string }[] = [],
): Promise<{ error?: string; ok?: boolean }> {
  const { supabase, userId } = await requireUser();
  if (!(await isTrustedDevice(userId))) {
    return { error: "Desligue num dispositivo confiável." };
  }
  // Trava anti-perda: se alguma cápsula ainda chegou cifrada, apagar as chaves
  // agora a tornaria ilegível pra sempre. Aborta antes de destruir qualquer coisa.
  if (capsules.some((c) => c.content.startsWith("enc:v1:"))) {
    return { error: "Uma cápsula ainda está cifrada — destranque e tente de novo." };
  }

  // 1) Reescreve em texto puro (se algo falhar aqui, os textos já viram legíveis
  //    — decryptEntry devolve texto sem prefixo como está, então é seguro).
  for (const e of entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.week_start)) continue;
    const { error } = await supabase
      .from("journal_entries")
      .update({ content: e.content, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("week_start", e.week_start);
    if (error) return { error: error.message };
  }

  // 1b) Idem pras cápsulas que estavam cifradas com a mesma DEK.
  for (const c of capsules) {
    const { error } = await supabase
      .from("time_capsules")
      .update({ content: c.content, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("id", c.id);
    if (error) return { error: error.message };
  }

  // 2) Remove as chaves → diário privado OFF.
  const { error: delErr } = await supabase.from("diary_keys").delete().eq("user_id", userId);
  if (delErr) return { error: delErr.message };

  revalidatePath("/diario");
  revalidatePath("/capsulas");
  return { ok: true };
}
