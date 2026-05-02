"use server";

import { hashPin, verifyPin } from "@/lib/pin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deleteWebhook, getMe, sendMessage, setWebhook } from "@/lib/telegram";
import { isValidTheme } from "@/lib/themes";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export async function updateTheme(theme: string) {
  if (!isValidTheme(theme)) return { error: "Tema inválido" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };
  await supabase.from("profiles").update({ theme }).eq("id", user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

const PIN_RE = /^\d{4,8}$/;

export async function changePin(fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const current = fd.get("current")?.toString() ?? "";
  const next = fd.get("next")?.toString() ?? "";
  const confirm = fd.get("confirm")?.toString() ?? "";

  if (!PIN_RE.test(next)) return { error: "Novo PIN deve ter 4 a 8 dígitos" };
  if (next !== confirm) return { error: "Novos PINs não conferem" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("pin_hash")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.pin_hash) return { error: "PIN ainda não configurado — vá em /diario" };

  const ok = await verifyPin(current, profile.pin_hash);
  if (!ok) return { error: "PIN atual incorreto" };

  const hash = await hashPin(next);
  const { error } = await supabase.from("profiles").update({ pin_hash: hash }).eq("id", user.id);
  if (error) return { error: error.message };
  return { ok: true };
}

// --- TELEGRAM ------------------------------------------------------

async function appUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  if (!host) throw new Error("No host header");
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function connectTelegram(): Promise<{
  ok?: boolean;
  error?: string;
  botUsername?: string;
}> {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return { error: "TELEGRAM_BOT_TOKEN não configurado no .env" };
  }
  if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
    return { error: "TELEGRAM_WEBHOOK_SECRET não configurado no .env" };
  }

  const url = `${await appUrl()}/api/telegram/webhook`;
  if (!url.startsWith("https://")) {
    return {
      error:
        "Telegram só aceita webhook HTTPS. Faça deploy no Vercel primeiro (ou use ngrok pra testar localmente).",
    };
  }

  try {
    await setWebhook(url);
    const me = await getMe();
    return { ok: true, botUsername: me.username };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao conectar" };
  }
}

export async function disconnectTelegram(): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  await supabase.from("profiles").update({ telegram_chat_id: null }).eq("id", user.id);

  try {
    await deleteWebhook();
  } catch {
    // ignora — perfil já foi limpo
  }

  revalidatePath("/config");
  return { ok: true };
}

export async function deleteAccount(): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function updateLocale(locale: string): Promise<{ ok?: boolean; error?: string }> {
  const allowed = ["pt-BR", "en"];
  if (!allowed.includes(locale)) return { error: "Invalid locale" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  await supabase.from("profiles").update({ locale }).eq("id", user.id);

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function sendTelegramTest(): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("telegram_chat_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.telegram_chat_id)
    return { error: "Bot ainda não está vinculado. Mande /start no bot primeiro." };

  try {
    await sendMessage(
      profile.telegram_chat_id,
      "🏓 <b>Teste do Rotina</b>\n\nSe você está vendo essa mensagem, o lembrete está funcionando.",
    );
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao enviar" };
  }
}
