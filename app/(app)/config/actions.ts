"use server";

import { TRUSTED_COOKIE, signTrustedDevice, trustedCookieOptions } from "@/lib/device";
import { isValidPrimary } from "@/lib/nav-items";
import { notifyUser } from "@/lib/notify";
import { hashPin, verifyPin } from "@/lib/pin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deleteWebhook, getMe, sendMessage, setWebhook } from "@/lib/telegram";
import { isValidTheme } from "@/lib/themes";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

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

/**
 * Escolhe quais 4 módulos ocupam a barra inferior do celular.
 *
 * A validação é server-side porque o array vem do cliente: exatamente 4, sem
 * repetição, todos módulos conhecidos. `/config` não está na lista de módulos
 * (é fixo na barra), então tentar mandá-lo já é barrado aqui.
 */
export async function updateNavPrimary(hrefs: string[]) {
  if (!isValidPrimary(hrefs)) return { error: "Seleção inválida" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };
  const { error } = await supabase
    .from("profiles")
    .update({ nav_primary: hrefs })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

const PIN_RE = /^\d{4,8}$/;

// --- CÓDIGO DE ESCRITA DO DIÁRIO -----------------------------------
// Destrava a ESCRITA no dispositivo atual, separado do PIN de leitura.
// Definir/acertar o código seta o cookie de device confiável (rotina_edit).

/** Define ou altera o código de escrita. Ao salvar, confia no device atual. */
export async function setWriteCode(fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const current = fd.get("current")?.toString() ?? "";
  const next = fd.get("next")?.toString() ?? "";
  const confirm = fd.get("confirm")?.toString() ?? "";

  if (!PIN_RE.test(next)) return { error: "O código deve ter 4 a 8 dígitos" };
  if (next !== confirm) return { error: "Os códigos não conferem" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("write_pin_hash")
    .eq("id", user.id)
    .maybeSingle();

  // Já existe um código → exige o atual pra alterar.
  if (profile?.write_pin_hash) {
    const ok = await verifyPin(current, profile.write_pin_hash);
    if (!ok) return { error: "Código atual incorreto" };
  }

  const hash = await hashPin(next);
  const { error } = await supabase
    .from("profiles")
    .update({ write_pin_hash: hash })
    .eq("id", user.id);
  if (error) return { error: error.message };

  // Confia neste dispositivo (libera a escrita aqui).
  const cookieStore = await cookies();
  cookieStore.set(TRUSTED_COOKIE, await signTrustedDevice(user.id), trustedCookieOptions());

  revalidatePath("/config");
  revalidatePath("/diario");
  return { ok: true };
}

/** Digita o código pra confiar NESTE dispositivo. Erro genérico se errado. */
export async function unlockWrite(fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const code = fd.get("code")?.toString() ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("write_pin_hash")
    .eq("id", user.id)
    .maybeSingle();

  // Erro genérico tanto pra "sem código" quanto pra "código errado".
  if (!profile?.write_pin_hash || !(await verifyPin(code, profile.write_pin_hash))) {
    return { error: "Código incorreto" };
  }

  const cookieStore = await cookies();
  cookieStore.set(TRUSTED_COOKIE, await signTrustedDevice(user.id), trustedCookieOptions());

  revalidatePath("/config");
  revalidatePath("/diario");
  return { ok: true };
}

/** Revoga a escrita só neste dispositivo (apaga o cookie). */
export async function revokeWriteHere(): Promise<{ ok?: boolean }> {
  const cookieStore = await cookies();
  cookieStore.delete(TRUSTED_COOKIE);
  revalidatePath("/config");
  revalidatePath("/diario");
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

// Janela em que o token de vínculo do Telegram é válido (min).
const TELEGRAM_LINK_TTL_MIN = 15;

export async function connectTelegram(): Promise<{
  ok?: boolean;
  error?: string;
  botUsername?: string;
  linkToken?: string;
}> {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return { error: "TELEGRAM_BOT_TOKEN não configurado no .env" };
  }
  if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
    return { error: "TELEGRAM_WEBHOOK_SECRET não configurado no .env" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

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

    // Token de uso único que amarra ESTE usuário ao /start do bot. Sem ele,
    // qualquer chat que mande /start se vincularia à conta (sequestro).
    const linkToken = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + TELEGRAM_LINK_TTL_MIN * 60_000).toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({ telegram_link_token: linkToken, telegram_link_expires_at: expiresAt })
      .eq("id", user.id);
    if (error) return { error: `Não consegui gerar o código de vínculo: ${error.message}` };

    return { ok: true, botUsername: me.username, linkToken };
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  await supabase.from("profiles").update({ locale }).eq("id", user.id);

  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

// --- PROFILE -------------------------------------------------------

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PW_MIN = 8;

/** Update the formal name + the dashboard nickname (apelido). */
export async function updateProfileNames(fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const fullName = fd.get("full_name")?.toString().trim() ?? "";
  const displayName = fd.get("display_name")?.toString().trim() ?? "";

  if (fullName.length > 80) return { error: "Nome muito longo (máx. 80 caracteres)" };
  if (displayName.length > 40) return { error: "Apelido muito longo (máx. 40 caracteres)" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName || null, display_name: displayName || null })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Change the account email — Supabase sends a confirmation link. */
export async function updateEmail(fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const email = fd.get("email")?.toString().trim().toLowerCase() ?? "";
  if (!EMAIL_RE.test(email)) return { error: "Email inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };
  if (email === user.email) return { error: "Esse já é o seu email atual" };

  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { error: error.message };
  return { ok: true };
}

/** Change the password — re-authenticates with the current one first. */
export async function updatePassword(fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const current = fd.get("current")?.toString() ?? "";
  const next = fd.get("next")?.toString() ?? "";
  const confirm = fd.get("confirm")?.toString() ?? "";

  if (next.length < PW_MIN) return { error: `Nova senha precisa de ao menos ${PW_MIN} caracteres` };
  if (next !== confirm) return { error: "As novas senhas não conferem" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "unauthenticated" };

  // Verify the current password on a throwaway client so the
  // sign-in attempt never touches the real session cookies.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { error: "Configuração do Supabase ausente" };
  const checker = createSupabaseClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInErr } = await checker.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (signInErr) return { error: "Senha atual incorreta" };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.message };
  return { ok: true };
}

// --- PUSH (notificações próprias) -----------------------------------

/**
 * Grava (ou revalida) a assinatura de push deste aparelho.
 *
 * `push_subscriptions` só tem policy de select/insert/delete — de propósito,
 * não existe policy de UPDATE. Um `upsert(..., { onConflict: "endpoint" })`
 * feito pelo client de cookie, quando o endpoint já existe, vira
 * `INSERT ... ON CONFLICT DO UPDATE`, e a parte de UPDATE é regida pela
 * policy de UPDATE que não existe — o Postgres barra essa branch por RLS.
 * Ou seja: reinscrever o MESMO aparelho (o navegador reemite a assinatura
 * sozinho às vezes) falharia sempre, e se o erro fosse ignorado no cliente
 * isso viraria uma falha muda de push. Por isso aqui é delete-then-insert:
 * duas operações, cada uma coberta por uma policy que já existe, sem tocar
 * em UPDATE e sem precisar do admin client pra essa escrita.
 */
export async function savePushSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<{ ok?: boolean; error?: string; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  // Remove uma assinatura anterior do MESMO endpoint (se houver, e se for
  // deste usuário — o filtro por user_id é defesa em profundidade além do
  // RLS) antes de inserir de novo.
  const { error: delError } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", sub.endpoint)
    .eq("user_id", user.id);
  if (delError) return { error: delError.message };

  // `.select("id").single()` devolve o id da linha recém-criada — o client
  // (NotifyChannels) usa isso pra saber qual linha é "este aparelho" sem
  // esperar um reload, tanto no subscribe manual quanto na reconciliação
  // silenciosa.
  const { data, error } = await supabase
    .from("push_subscriptions")
    .insert({
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: sub.userAgent ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/config");
  return { ok: true, id: data.id };
}

/** Remove um aparelho da lista. */
export async function removePushSubscription(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // defesa em profundidade além do RLS
  if (error) return { error: error.message };
  revalidatePath("/config");
  return { ok: true };
}

/** Liga/desliga os canais de notificação. */
export async function updateNotifyChannels(
  push: boolean,
  telegram: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };
  const { error } = await supabase
    .from("profiles")
    .update({ notify_push: push, notify_telegram: telegram })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/config");
  return { ok: true };
}

/**
 * Manda uma notificação de teste pelos canais ligados.
 * É a única forma de saber se push funciona no aparelho sem esperar as 8h.
 * Usa o admin client porque `notifyUser` precisa enxergar todos os aparelhos
 * do usuário pra decidir os canais — a autorização já foi feita acima pelo
 * client de cookie, o admin aqui é só o transporte, igual será nos crons.
 */
export async function sendTestNotification(): Promise<
  { ok?: boolean; error?: string } & Partial<Awaited<ReturnType<typeof notifyUser>>>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };
  const r = await notifyUser(createAdminClient(), user.id, {
    title: "Touvie",
    text: "Notificação de teste — se você está vendo isso, está funcionando. 🎉",
    url: "/config",
  });
  return { ok: true, ...r };
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
