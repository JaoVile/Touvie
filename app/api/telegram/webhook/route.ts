import { todayBRTISO } from "@/lib/datetime";
import { guessCategory } from "@/lib/importers/csv";
import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type TelegramUpdate,
  WEBHOOK_SECRET_HEADER,
  escapeHtml,
  sendMessage,
  verifyWebhookSecret,
} from "@/lib/telegram";
import { formatBRL } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (!verifyWebhookSecret(req.headers.get(WEBHOOK_SECRET_HEADER))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const msg = update.message;
  if (!msg?.text || !msg.chat) return NextResponse.json({ ok: true });

  const text = msg.text.trim();
  const chatId = msg.chat.id;

  let userId: string | null = null;

  // Um comando que já escreveu no banco NÃO pode fazer a rota retornar erro: o
  // Telegram reentrega updates não-2xx, o que reprocessaria o comando e duplicaria
  // a transação. Por isso engolimos qualquer falha aqui (ex.: sendMessage) e
  // sempre devolvemos 200 — o erro vai só pro log.
  try {
    if (text === "/start" || text.startsWith("/start ")) {
      userId = await handleStart(chatId, text);
    } else if (text === "/stop") {
      userId = await handleStop(chatId);
    } else if (text === "/ping") {
      await sendMessage(chatId, "🏓 Pong!");
    } else if (text.startsWith("/gasto")) {
      userId = await handleGasto(chatId, text);
    } else if (text.startsWith("/receita")) {
      userId = await handleReceita(chatId, text);
    } else if (text === "/saldo") {
      userId = await handleSaldo(chatId);
    }
    logEvent({
      userId,
      eventType: "webhook",
      source: "telegram/webhook",
      status: "success",
      messagePreview: text.slice(0, 40),
      metadata: { chat_id: chatId, command: text },
    });
  } catch (err) {
    logEvent({
      userId,
      eventType: "webhook",
      source: "telegram/webhook",
      status: "error",
      messagePreview: err instanceof Error ? err.message : String(err),
      metadata: { chat_id: chatId, command: text.slice(0, 40) },
    });
  }

  return NextResponse.json({ ok: true });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function resolveProfile(
  chatId: number,
): Promise<{ userId: string; accountId: string } | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("telegram_chat_id", String(chatId))
    .maybeSingle();
  if (!profile) return null;

  // Modelo "um total só": o lançamento precisa de uma conta pra entrar no saldo
  // (a view soma `where account_id = a.id`). Espelha o defaultAccountId do app:
  // prefere a primeira conta não-cartão, ou cria a "Carteira" na hora.
  const { data: accs } = await admin
    .from("finance_accounts")
    .select("id, kind")
    .eq("user_id", profile.id)
    .eq("archived", false)
    .order("created_at", { ascending: true });
  const preferred = (accs ?? []).find((a) => a.kind !== "credit") ?? accs?.[0];
  if (preferred) return { userId: profile.id, accountId: preferred.id as string };

  const { data: created } = await admin
    .from("finance_accounts")
    .insert({ user_id: profile.id, name: "Carteira", kind: "cash", balance_cents: 0 })
    .select("id")
    .single();
  if (!created) return null;
  return { userId: profile.id, accountId: created.id as string };
}

function parseTxArgs(text: string): { amountCents: number; description: string } | null {
  // /gasto 45,90 iFood  OR  /gasto 45.90 iFood
  const parts = text.split(/\s+/).slice(1);
  if (parts.length < 1) return null;
  const raw = parts[0].replace(",", ".");
  const amount = Number.parseFloat(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const amountCents = Math.round(amount * 100);
  const description = parts.slice(1).join(" ") || "Gasto avulso";
  return { amountCents, description };
}

async function resolveCategoryId(userId: string, description: string): Promise<string | null> {
  const catName = guessCategory(description);
  if (!catName) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("finance_categories")
    .select("id")
    .eq("user_id", userId)
    .eq("name", catName)
    .maybeSingle();
  return data?.id ?? null;
}

// ─── Command handlers ───────────────────────────────────────────────────────

const CONNECTED_MSG =
  "✅ <b>Conectado!</b>\n\nVocê vai receber lembretes às <b>08:00</b> e <b>20:00</b>.\n\nComandos:\n• /ping — testar\n• /gasto 45,90 iFood — registrar gasto\n• /receita 500 Freela — registrar receita\n• /saldo — ver resumo do mês\n• /stop — desconectar";

async function handleStart(chatId: number, text: string): Promise<string | null> {
  const admin = createAdminClient();
  const token = text.split(/\s+/)[1]?.trim() ?? "";

  // /start sem token: NÃO vincula (era por aqui que qualquer estranho assumia a
  // conta). Se este chat já está vinculado, só confirma; senão manda pro app.
  if (!token) {
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("telegram_chat_id", String(chatId))
      .maybeSingle();
    if (existing) {
      await sendMessage(
        chatId,
        "✅ Você já está conectado. Use /saldo, /gasto, /receita ou /stop.",
      );
      return existing.id;
    }
    await sendMessage(
      chatId,
      "🔒 Pra conectar com segurança, abra o Touvie → <b>Config → Telegram</b> e toque em <b>Conectar bot</b>. O botão abre este chat já com seu código de vínculo.",
    );
    return null;
  }

  // Token de uso único, emitido na tela autenticada e ainda válido.
  const { data: profile } = await admin
    .from("profiles")
    .select("id, telegram_link_expires_at")
    .eq("telegram_link_token", token)
    .maybeSingle();

  const valid =
    profile?.telegram_link_expires_at &&
    new Date(profile.telegram_link_expires_at).getTime() > Date.now();

  if (!profile || !valid) {
    await sendMessage(
      chatId,
      "❌ Código de vínculo inválido ou expirado. Gere um novo no Touvie → Config → Telegram.",
    );
    return null;
  }

  // Garante que este chat não fique vinculado a dois perfis, então amarra ao
  // dono do token e QUEIMA o token (uso único).
  await admin
    .from("profiles")
    .update({ telegram_chat_id: null })
    .eq("telegram_chat_id", String(chatId));
  await admin
    .from("profiles")
    .update({
      telegram_chat_id: String(chatId),
      telegram_link_token: null,
      telegram_link_expires_at: null,
    })
    .eq("id", profile.id);

  await sendMessage(chatId, CONNECTED_MSG);
  return profile.id;
}

async function handleStop(chatId: number): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("telegram_chat_id", String(chatId))
    .maybeSingle();
  await admin
    .from("profiles")
    .update({ telegram_chat_id: null })
    .eq("telegram_chat_id", String(chatId));
  await sendMessage(chatId, "✅ Desconectado. Mande /start a qualquer momento pra reativar.");
  return data?.id ?? null;
}

async function handleGasto(chatId: number, text: string): Promise<string | null> {
  const profile = await resolveProfile(chatId);
  if (!profile) {
    await sendMessage(chatId, "❌ Conta não vinculada. Mande /start primeiro.");
    return null;
  }

  const parsed = parseTxArgs(text);
  if (!parsed) {
    await sendMessage(chatId, "❌ Formato: <code>/gasto 45,90 Descrição</code>");
    return profile.userId;
  }

  const [categoryId] = await Promise.all([resolveCategoryId(profile.userId, parsed.description)]);

  const admin = createAdminClient();
  const { error } = await admin.from("transactions").insert({
    user_id: profile.userId,
    account_id: profile.accountId,
    category_id: categoryId,
    kind: "expense",
    amount_cents: parsed.amountCents,
    description: parsed.description,
    occurred_on: todayBRTISO(),
  });

  if (error) {
    console.error("telegram/handleGasto insert failed", error.message);
    await sendMessage(chatId, "❌ Não consegui salvar o gasto agora. Tenta de novo em instantes.");
    return profile.userId;
  }

  const cat = categoryId ? ` · ${escapeHtml(guessCategory(parsed.description) ?? "")}` : "";
  await sendMessage(
    chatId,
    `✅ Gasto registrado!\n💸 <b>${formatBRL(parsed.amountCents)}</b> — ${escapeHtml(parsed.description)}${cat}`,
  );
  return profile.userId;
}

async function handleReceita(chatId: number, text: string): Promise<string | null> {
  const profile = await resolveProfile(chatId);
  if (!profile) {
    await sendMessage(chatId, "❌ Conta não vinculada. Mande /start primeiro.");
    return null;
  }

  const parsed = parseTxArgs(text);
  if (!parsed) {
    await sendMessage(chatId, "❌ Formato: <code>/receita 500 Freela</code>");
    return profile.userId;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("transactions").insert({
    user_id: profile.userId,
    account_id: profile.accountId,
    kind: "income",
    amount_cents: parsed.amountCents,
    description: parsed.description,
    occurred_on: todayBRTISO(),
  });

  if (error) {
    console.error("telegram/handleReceita insert failed", error.message);
    await sendMessage(
      chatId,
      "❌ Não consegui salvar a receita agora. Tenta de novo em instantes.",
    );
    return profile.userId;
  }

  await sendMessage(
    chatId,
    `✅ Receita registrada!\n💰 <b>${formatBRL(parsed.amountCents)}</b> — ${escapeHtml(parsed.description)}`,
  );
  return profile.userId;
}

async function handleSaldo(chatId: number): Promise<string | null> {
  const profile = await resolveProfile(chatId);
  if (!profile) {
    await sendMessage(chatId, "❌ Conta não vinculada. Mande /start primeiro.");
    return null;
  }

  const admin = createAdminClient();
  const now = new Date();
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // .returns<T>() sobrescreve o tipo do embed: sem metadata de Relationship
  // no Database type, o supabase-js não resolve `finance_categories(name)`
  // sozinho e a row colapsaria pra `never`.
  type SaldoRow = {
    kind: "income" | "expense";
    amount_cents: number;
    category_id: string | null;
    finance_categories: { name: string } | null;
  };
  const { data: txs } = await admin
    .from("transactions")
    .select("kind, amount_cents, category_id, finance_categories(name)")
    .eq("user_id", profile.userId)
    .gte("occurred_on", firstDay)
    .returns<SaldoRow[]>();

  let income = 0;
  let expense = 0;
  const byCategory: Record<string, number> = {};

  for (const tx of txs ?? []) {
    if (tx.kind === "income") {
      income += tx.amount_cents;
    } else {
      expense += tx.amount_cents;
      const catName = tx.finance_categories?.name ?? "Outros";
      byCategory[catName] = (byCategory[catName] ?? 0) + tx.amount_cents;
    }
  }

  const balance = income - expense;
  const sign = balance >= 0 ? "+" : "";

  const topCats = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, cents]) => `  • ${escapeHtml(name)}: ${formatBRL(cents)}`)
    .join("\n");

  const monthName = now.toLocaleString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });

  await sendMessage(
    chatId,
    `📊 <b>Resumo de ${monthName}</b>\n\n💰 Receitas: <b>${formatBRL(income)}</b>\n💸 Gastos: <b>${formatBRL(expense)}</b>\n📈 Saldo: <b>${sign}${formatBRL(balance)}</b>\n${topCats ? `\n<b>Top gastos por categoria:</b>\n${topCats}` : ""}`,
  );

  return profile.userId;
}
