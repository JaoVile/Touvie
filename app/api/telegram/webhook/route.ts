import { todayBRTISO } from "@/lib/datetime";
import { guessCategory } from "@/lib/importers/csv";
import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import {
  type InlineButton,
  type InlineKeyboard,
  type TelegramCallbackQuery,
  type TelegramUpdate,
  WEBHOOK_SECRET_HEADER,
  answerCallbackQuery,
  editMessageText,
  escapeHtml,
  sendChatAction,
  sendMessage,
  sendMessageWithKeyboard,
  verifyWebhookSecret,
} from "@/lib/telegram";
import { DESTRUCTIVE_ACTIONS, type ToubeAction } from "@/lib/toube";
import { executeToube } from "@/lib/toube-execute";
import { runToubeTurn } from "@/lib/toube-turn";
import { formatBRL } from "@/lib/utils";
import { NextResponse, after } from "next/server";

// O trabalho do `after()` conta no orçamento de duração da função, e o caminho
// de texto livre é o mais longo que existe aqui: insert + update +
// sendChatAction + runToubeTurn (que pode fazer DUAS rodadas de modelo com
// tool-calling, mais a compactação no Groq) + insert + sendMessageWithKeyboard
// + update. No default do plano Hobby (10s) o turno é cortado no meio: a fala
// da pessoa já gravada, resposta nenhuma e sem log.
export const maxDuration = 60;

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

  // callback_query (toque em botão) não tem `message.text` — precisa ser
  // roteado ANTES do early-return que exige `msg?.text`, senão cai no return
  // silencioso abaixo e o toque não faz absolutamente nada.
  if (update.callback_query) {
    const cb = update.callback_query;
    after(async () => {
      try {
        await handleCallback(cb);
      } catch (err) {
        logEvent({
          userId: null,
          eventType: "webhook",
          source: "telegram/toube",
          status: "error",
          messagePreview: err instanceof Error ? err.message : String(err),
          metadata: { callback: cb.data },
        });
        // Uma exceção também é caminho de saída: sem isso o spinner do botão
        // fica girando pra sempre e a pessoa não recebe nenhum aviso. `call()`
        // em lib/telegram.ts lança em toda resposta não-ok da API do Telegram,
        // então isto acontece de verdade, não só em teoria.
        await answerCallbackQuery(cb.id, "Deu erro — tenta de novo.").catch(() => {});
      }
    });
    return NextResponse.json({ ok: true });
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
    } else if (text.startsWith("/")) {
      await sendMessage(
        chatId,
        "Comando desconhecido. Use /ping, /gasto, /receita, /saldo ou /stop — ou fale comigo normalmente. 🙂",
      );
    } else {
      // Texto livre: responde 200 já e processa o Toube fora do caminho da
      // resposta (after) — senão o Telegram reentrega o update e paga o modelo
      // duas vezes. O try/catch AQUI DENTRO é obrigatório: uma rejeição depois
      // do 200 é invisível pro chamador, então só vira log e mensagem de erro
      // pra pessoa — sem ele o "Toube não respondeu" não deixaria rastro.
      after(async () => {
        try {
          await handleToubeText(chatId, text);
        } catch (err) {
          logEvent({
            userId: null,
            eventType: "webhook",
            source: "telegram/toube",
            status: "error",
            messagePreview: err instanceof Error ? err.message : String(err),
            metadata: { chat_id: chatId },
          });
          await sendMessage(chatId, "😵 Não consegui pensar agora. Tenta de novo?").catch(() => {});
        }
      });
    }
    logEvent({
      userId,
      eventType: "webhook",
      source: "telegram/webhook",
      status: "success",
      messagePreview: text.slice(0, 40),
      // Texto livre NÃO vai pro metadata: `metadata` é jsonb sem limite, então
      // `command: text` duplicaria a conversa inteira com o Toube num log que a
      // pessoa não lê (a policy de app_logs é `auth.uid() = user_id`, e aqui o
      // userId do caminho de texto livre é sempre null — ele é resolvido dentro
      // do after()) nem apaga pelo "limpar histórico". Comando é outra coisa:
      // é sintaxe fixa, e ainda assim vai truncado como nos outros ramos.
      metadata: text.startsWith("/")
        ? { chat_id: chatId, command: text.slice(0, 40) }
        : { chat_id: chatId },
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

/**
 * Quem é o dono deste chat — e SÓ isso. Separado de `resolveAccountId` de
 * propósito: juntos, os dois faziam qualquer "oi" no Telegram criar uma conta
 * "Carteira" no módulo de finanças, e faziam uma falha ao criar essa conta
 * virar "❌ Conta não vinculada. Mande /start primeiro." numa conta vinculada
 * perfeitamente — a pessoa desvincularia e revincularia atrás de um problema
 * que não existe. `null` aqui significa exatamente uma coisa: chat sem vínculo.
 */
async function resolveUserId(chatId: number): Promise<string | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("telegram_chat_id", String(chatId))
    .maybeSingle();
  return profile?.id ?? null;
}

/**
 * Conta pra pendurar o lançamento — só quem escreve em finanças (/gasto,
 * /receita) chama. Modelo "um total só": o lançamento precisa de uma conta pra
 * entrar no saldo (a view soma `where account_id = a.id`). Espelha o
 * defaultAccountId do app: prefere a primeira conta não-cartão, ou cria a
 * "Carteira" na hora.
 */
async function resolveAccountId(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: accs } = await admin
    .from("finance_accounts")
    .select("id, kind")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("created_at", { ascending: true });
  const preferred = (accs ?? []).find((a) => a.kind !== "credit") ?? accs?.[0];
  if (preferred) return preferred.id as string;

  const { data: created } = await admin
    .from("finance_accounts")
    .insert({ user_id: userId, name: "Carteira", kind: "cash", balance_cents: 0 })
    .select("id")
    .single();
  return (created?.id as string) ?? null;
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
  const userId = await resolveUserId(chatId);
  if (!userId) {
    await sendMessage(chatId, "❌ Conta não vinculada. Mande /start primeiro.");
    return null;
  }

  const parsed = parseTxArgs(text);
  if (!parsed) {
    await sendMessage(chatId, "❌ Formato: <code>/gasto 45,90 Descrição</code>");
    return userId;
  }

  const [accountId, categoryId] = await Promise.all([
    resolveAccountId(userId),
    resolveCategoryId(userId, parsed.description),
  ]);
  if (!accountId) {
    await sendMessage(
      chatId,
      "❌ Não consegui preparar sua conta de finanças agora. Tenta de novo em instantes.",
    );
    return userId;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("transactions").insert({
    user_id: userId,
    account_id: accountId,
    category_id: categoryId,
    kind: "expense",
    amount_cents: parsed.amountCents,
    description: parsed.description,
    occurred_on: todayBRTISO(),
  });

  if (error) {
    console.error("telegram/handleGasto insert failed", error.message);
    await sendMessage(chatId, "❌ Não consegui salvar o gasto agora. Tenta de novo em instantes.");
    return userId;
  }

  const cat = categoryId ? ` · ${escapeHtml(guessCategory(parsed.description) ?? "")}` : "";
  await sendMessage(
    chatId,
    `✅ Gasto registrado!\n💸 <b>${formatBRL(parsed.amountCents)}</b> — ${escapeHtml(parsed.description)}${cat}`,
  );
  return userId;
}

async function handleReceita(chatId: number, text: string): Promise<string | null> {
  const userId = await resolveUserId(chatId);
  if (!userId) {
    await sendMessage(chatId, "❌ Conta não vinculada. Mande /start primeiro.");
    return null;
  }

  const parsed = parseTxArgs(text);
  if (!parsed) {
    await sendMessage(chatId, "❌ Formato: <code>/receita 500 Freela</code>");
    return userId;
  }

  const accountId = await resolveAccountId(userId);
  if (!accountId) {
    await sendMessage(
      chatId,
      "❌ Não consegui preparar sua conta de finanças agora. Tenta de novo em instantes.",
    );
    return userId;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("transactions").insert({
    user_id: userId,
    account_id: accountId,
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
    return userId;
  }

  await sendMessage(
    chatId,
    `✅ Receita registrada!\n💰 <b>${formatBRL(parsed.amountCents)}</b> — ${escapeHtml(parsed.description)}`,
  );
  return userId;
}

// /saldo só LÊ transações — não precisa (nem cria) conta.
async function handleSaldo(chatId: number): Promise<string | null> {
  const userId = await resolveUserId(chatId);
  if (!userId) {
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
    .eq("user_id", userId)
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

  return userId;
}

// ─── Toube (texto livre) ────────────────────────────────────────────────────

/** Sessão dedicada do Telegram (uma por usuário, garantida por índice único). */
async function telegramSessionId(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data: existing } = await admin
    .from("toube_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("source", "telegram")
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from("toube_sessions")
    .insert({ user_id: userId, source: "telegram", title: "Telegram" })
    .select("id")
    .single();
  if (created) return created.id;

  // Corrida: duas mensagens seguidas ("oi" + a pergunta) viram dois after()
  // concorrentes — ambos veem "não existe" no select acima e tentam criar. O
  // índice único parcial (migration 0039) barra o segundo insert com 23505;
  // em vez de estourar e perder o turno, refaz o select e reusa a sessão que
  // o outro já criou.
  if (error?.code === "23505") {
    const { data: retry } = await admin
      .from("toube_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "telegram")
      .maybeSingle();
    if (retry) return retry.id;
  }
  throw new Error("Não consegui abrir a conversa do Telegram.");
}

/** Rótulo curto pro botão de confirmação (o Telegram corta texto longo). */
function proposalShortLabel(p: { action: string; args: Record<string, unknown> }): string {
  const t = String(p.args.title ?? p.args.titulo ?? p.args.mensagem ?? "");
  const short = t.length > 20 ? `${t.slice(0, 20)}…` : t;
  return short || p.action.replace(/_/g, " ");
}

type PendingProposal = { action: ToubeAction; args: Record<string, unknown> };

/**
 * O par ✅/✖️ de uma linha pendente. `callback_data` tem teto de 64 bytes no
 * Telegram: `tb:` + uuid (36) = 39 bytes, e 41 com o sufixo `:n`/`:d`.
 */
function proposalButtons(rowId: string, p: PendingProposal): InlineButton[] {
  return [
    { text: `✅ ${proposalShortLabel(p)}`, callback_data: `tb:${rowId}` },
    { text: "✖️", callback_data: `tb:${rowId}:n` },
  ];
}

/**
 * A proposta de uma linha. A coluna guarda um array de UM elemento (formato
 * escrito por `handleToubeText`); tolera o objeto solto por segurança, mas
 * nunca inventa: json inesperado devolve `null` e o chamador avisa em vez de
 * executar qualquer coisa.
 */
function firstProposal(raw: Json): PendingProposal | null {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!first || typeof first !== "object" || Array.isArray(first)) return null;
  const action = (first as { action?: unknown }).action;
  if (typeof action !== "string") return null;
  const args = (first as { args?: unknown }).args;
  return {
    action: action as ToubeAction,
    args: args && typeof args === "object" ? (args as Record<string, unknown>) : {},
  };
}

/**
 * Os botões que AINDA dá pra confirmar nesta mensagem. Uma mensagem carrega
 * vários botões, mas todo caminho do callback termina em `editMessageText`, que
 * reescreve a mensagem inteira e derruba o teclado — sem remontar o que sobrou,
 * confirmar a primeira proposta deixaria as outras vivas no banco e
 * inalcançáveis até expirar. Só entra o que continua pendente e no prazo, então
 * um botão remontado sempre corresponde a algo que de fato ainda não rodou.
 * `excludeId` tira a própria linha (o primeiro toque da destrutiva, que abre a
 * pergunta "apagar de vez?" sem consumir nada).
 */
async function remainingKeyboard(
  admin: ReturnType<typeof createAdminClient>,
  chatId: number,
  messageId: number,
  userId: string,
  excludeId?: string,
): Promise<InlineKeyboard | undefined> {
  const { data, error } = await admin
    .from("toube_pending_proposals")
    .select("id, proposals")
    .eq("user_id", userId)
    .eq("chat_id", String(chatId))
    .eq("message_id", messageId)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    logEvent({
      userId,
      eventType: "webhook",
      source: "telegram/toube",
      status: "error",
      messagePreview: error.message,
      metadata: { chat_id: chatId, stage: "remaining_keyboard" },
    });
    return undefined;
  }
  const rows = (data ?? [])
    .filter((r) => r.id !== excludeId)
    .map((r) => {
      const p = firstProposal(r.proposals);
      return p ? proposalButtons(r.id, p) : null;
    })
    .filter((r): r is InlineButton[] => r !== null);
  return rows.length ? { inline_keyboard: rows } : undefined;
}

/**
 * Texto livre (não-comando) do Telegram: grava a fala, roda o turno do Toube e
 * responde. Se vierem propostas, grava UMA LINHA POR PROPOSTA em
 * `toube_pending_proposals` e manda com botões — `handleCallback` trata o toque.
 */
async function handleToubeText(chatId: number, text: string): Promise<string | null> {
  const userId = await resolveUserId(chatId);
  if (!userId) {
    await sendMessage(chatId, "❌ Conta não vinculada. Mande /start primeiro.");
    return null;
  }
  const admin = createAdminClient();
  const ctx = { supabase: admin, userId };
  const sessionId = await telegramSessionId(admin, userId);

  // Se este insert falhar, runToubeTurn lê o histórico do banco sem a fala
  // atual — o modelo responderia à mensagem ANTERIOR (ou a histórico vazio na
  // primeira vez), gastando a chamada paga numa resposta errada e sem deixar
  // rastro. Por isso lança em vez de engolir: o catch do after() loga e avisa.
  const { error: userMsgError } = await admin.from("toube_messages").insert({
    user_id: userId,
    session_id: sessionId,
    role: "user",
    content: text,
  });
  if (userMsgError) throw userMsgError;
  await admin
    .from("toube_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  await sendChatAction(chatId);
  const { result } = await runToubeTurn(ctx, { sessionId });

  if (result.kind !== "proposals") {
    await sendMessage(chatId, escapeHtml(result.text));
    return userId;
  }

  // UMA LINHA POR PROPOSTA. `consumed_at` é da linha inteira, então um lote de N
  // propostas numa linha só fazia a confirmação de UMA consumir todas as outras:
  // "gastei 40 no mercado e me lembra do aluguel" vira dois botões, a pessoa
  // confirma o gasto e, ao tocar no segundo, ouve "isso já foi feito" sobre um
  // lembrete que nunca existiu. Separadas, cada proposta confirma, cancela e
  // expira sozinha — igual à web, que faz patch por índice.
  //
  // Os ids saem daqui (e não do RETURNING) pra o pareamento proposta↔linha não
  // depender da ordem em que o Postgres devolve as linhas do insert em lote.
  const prepared = result.proposals.map((p) => ({ id: crypto.randomUUID(), proposal: p }));
  const { error: pendingError } = await admin.from("toube_pending_proposals").insert(
    prepared.map(({ id, proposal }) => ({
      id,
      user_id: userId,
      chat_id: String(chatId),
      // Array de UM elemento: a coluna segue `jsonb not null` como está na
      // migration 0039 e o leitor (`firstProposal`) sempre pega o [0].
      proposals: [proposal] as unknown as Json,
    })),
  );
  if (pendingError) {
    // Sem as linhas, não tem como montar callback_data (`tb:<uuid>`) — a pessoa
    // não pode confirmar a proposta. Isso não pode falhar em silêncio: loga o
    // motivo e avisa explicitamente que a confirmação não saiu.
    logEvent({
      userId,
      eventType: "webhook",
      source: "telegram/toube",
      status: "error",
      messagePreview: pendingError.message,
      metadata: { chat_id: chatId },
    });
    await sendMessage(
      chatId,
      `${escapeHtml(result.text)}\n\n⚠️ Não consegui preparar a confirmação agora — tenta de novo em instantes.`,
    );
    return userId;
  }

  const ids = prepared.map((x) => x.id);
  const rows = prepared.map(({ id, proposal }) => proposalButtons(id, proposal));
  let messageId: number | null;
  try {
    messageId = await sendMessageWithKeyboard(chatId, escapeHtml(result.text), {
      inline_keyboard: rows,
    });
  } catch (err) {
    // call() em lib/telegram.ts lança quando o Telegram recusa o envio — não
    // devolve null. Sem tratar, as linhas em toube_pending_proposals ficariam
    // órfãs (sem message_id, handleCallback não teria como editar a mensagem
    // que nunca chegou). Apaga as linhas fantasma e deixa o erro subir pro
    // catch do after(), que loga e avisa a pessoa.
    await admin.from("toube_pending_proposals").delete().in("id", ids);
    throw err;
  }
  // TODAS as linhas do turno carimbam o MESMO message_id — é uma mensagem só,
  // com vários botões. É por ele que `remainingKeyboard` acha as irmãs: sem o
  // carimbo, confirmar uma proposta apaga o teclado e as outras ficam
  // inalcançáveis até expirar. Falha aqui é silenciosa pra pessoa (a mensagem
  // com botões JÁ chegou), então o log é a única testemunha — não deixe passar.
  const { error: stampError } = await admin
    .from("toube_pending_proposals")
    .update({ message_id: messageId })
    .in("id", ids);
  if (stampError || messageId == null) {
    logEvent({
      userId,
      eventType: "webhook",
      source: "telegram/toube",
      status: "error",
      messagePreview: stampError?.message ?? "sendMessage não devolveu message_id",
      metadata: { chat_id: chatId, pending_ids: ids },
    });
  }
  return userId;
}

// ─── Callback (toque em botão) ─────────────────────────────────────────────

/** Rodapé que avisa que sobrou proposta pra confirmar nesta mensagem. */
const STILL_PENDING = "\n\n<i>O que ainda dá pra confirmar está aí embaixo.</i>";

/**
 * Toque em botão de proposta. `callback_data` no formato `tb:<uuid>`
 * (confirmar), `tb:<uuid>:n` (cancelar) ou `tb:<uuid>:d` (segundo toque da
 * destrutiva) — cabe folgado nos 64 bytes do Telegram (41 no maior caso). O
 * uuid é o da LINHA, e cada linha guarda uma proposta só, então confirmar uma
 * não encosta nas outras da mesma mensagem. Ele vem do botão (input do
 * usuário) — quem executa é sempre resolvido pelo chat_id, e as duas coisas
 * têm que bater, senão um uuid vazado ou adivinhado executaria ação na conta
 * de outra pessoa.
 */
async function handleCallback(cb: TelegramCallbackQuery): Promise<string | null> {
  const chatId = cb.message?.chat.id;
  const messageId = cb.message?.message_id;
  const parts = (cb.data ?? "").split(":");
  if (!chatId || !messageId || parts[0] !== "tb") {
    await answerCallbackQuery(cb.id);
    return null;
  }
  const [, pendingId, mode] = parts;

  // Botão do formato antigo (`tb:<uuid>:<idx>`, de quando o lote inteiro morava
  // numa linha só). Sem o índice não dá pra saber QUAL proposta é, e executar a
  // errada seria pior do que não executar nada — então não executa e diz por quê.
  if (parts.length > 3 || (mode !== undefined && mode !== "n" && mode !== "d")) {
    await answerCallbackQuery(cb.id, "Botão vencido — me peça de novo.");
    await editMessageText(
      chatId,
      messageId,
      "⌛ <i>Esses botões são de antes de uma atualização — não fiz nada. Me peça de novo.</i>",
    );
    return null;
  }

  const userId = await resolveUserId(chatId);
  if (!userId) {
    await answerCallbackQuery(cb.id, "Conta não vinculada.");
    return null;
  }

  const admin = createAdminClient();
  const { data: pending, error: pendingError } = await admin
    .from("toube_pending_proposals")
    .select("id, user_id, proposals, consumed_at, expires_at")
    .eq("id", pendingId)
    .maybeSingle();
  if (pendingError) {
    logEvent({
      userId: null,
      eventType: "webhook",
      source: "telegram/toube",
      status: "error",
      messagePreview: pendingError.message,
      metadata: { pending_id: pendingId },
    });
  }

  // Dono: o uuid veio do botão, mas quem executa vem do chat_id. Os dois batem
  // ou não executa nada.
  if (!pending || pending.user_id !== userId) {
    await answerCallbackQuery(cb.id, "Essa proposta não é sua.");
    return null;
  }
  if (pending.consumed_at) {
    await answerCallbackQuery(cb.id, "Isso já foi feito.");
    await editMessageText(
      chatId,
      messageId,
      "✅ <i>Isso já foi feito.</i>",
      await remainingKeyboard(admin, chatId, messageId, userId),
    );
    return userId;
  }
  if (new Date(pending.expires_at).getTime() < Date.now()) {
    await answerCallbackQuery(cb.id, "Proposta expirada.");
    await editMessageText(
      chatId,
      messageId,
      "⌛ <i>Proposta expirada — me peça de novo.</i>",
      await remainingKeyboard(admin, chatId, messageId, userId),
    );
    return userId;
  }

  const p = firstProposal(pending.proposals);
  if (!p) {
    await answerCallbackQuery(cb.id, "Proposta não encontrada.");
    return userId;
  }

  if (mode === "n") {
    const claimed = await claimPending(admin, pending.id, userId);
    if (!claimed) {
      await answerCallbackQuery(cb.id, "Isso já foi feito.");
      await editMessageText(
        chatId,
        messageId,
        "✅ <i>Isso já foi feito.</i>",
        await remainingKeyboard(admin, chatId, messageId, userId),
      );
      return userId;
    }
    // A linha cancelada já saiu do remainingKeyboard (o claim carimbou
    // consumed_at), então o que volta são só as OUTRAS propostas da mensagem.
    const rest = await remainingKeyboard(admin, chatId, messageId, userId);
    await answerCallbackQuery(cb.id, "Cancelado.");
    await editMessageText(
      chatId,
      messageId,
      `✖️ <i>Cancelado — não fiz nada.</i>${rest ? STILL_PENDING : ""}`,
      rest,
    );
    return userId;
  }

  // Destrutiva: o primeiro ✅ só pede confirmação. Dedo errado numa lista de
  // botões não pode apagar meta. NÃO carimba consumed_at aqui — a proposta
  // segue pendente até o segundo toque ou o cancelamento (por isso esta linha
  // sai do remainingKeyboard por `excludeId`: o par Sim/Não já a representa).
  if (DESTRUCTIVE_ACTIONS.includes(p.action) && mode !== "d") {
    const others = await remainingKeyboard(admin, chatId, messageId, userId, pending.id);
    await answerCallbackQuery(cb.id);
    await editMessageText(
      chatId,
      messageId,
      `⚠️ Apagar <b>${escapeHtml(proposalShortLabel(p))}</b> de vez?`,
      {
        inline_keyboard: [
          [
            { text: "🗑 Sim, apagar", callback_data: `tb:${pending.id}:d` },
            { text: "✖️ Não", callback_data: `tb:${pending.id}:n` },
          ],
          ...(others?.inline_keyboard ?? []),
        ],
      },
    );
    return userId;
  }

  // Reivindica a linha ANTES de executar (update condicional a consumed_at
  // ainda nulo): dois toques rápidos no mesmo botão viram dois after()
  // concorrentes que leriam consumed_at=null e executariam a ação duas vezes
  // (gasto lançado em duplicidade, por exemplo). Só quem reivindica de fato
  // segue pra executeToube; o outro recebe "isso já foi feito".
  const claimed = await claimPending(admin, pending.id, userId);
  if (!claimed) {
    await answerCallbackQuery(cb.id, "Isso já foi feito.");
    await editMessageText(
      chatId,
      messageId,
      "✅ <i>Isso já foi feito.</i>",
      await remainingKeyboard(admin, chatId, messageId, userId),
    );
    return userId;
  }

  const res = await executeToube({ supabase: admin, userId }, p.action, p.args);
  if (!res.ok) {
    // A ação não rodou — desfaz o carimbo pra pessoa poder tentar de novo em
    // vez de ficar presa num "isso já foi feito" falso.
    const { error: unclaimError } = await admin
      .from("toube_pending_proposals")
      .update({ consumed_at: null })
      .eq("id", pending.id);
    if (unclaimError) {
      logEvent({
        userId,
        eventType: "webhook",
        source: "telegram/toube",
        status: "error",
        messagePreview: unclaimError.message,
        metadata: { pending_id: pending.id, stage: "unclaim" },
      });
    }
  }
  // DEPOIS do unclaim, de propósito: se a execução falhou, a linha voltou a
  // ficar pendente e o botão dela precisa reaparecer pra pessoa tentar de novo.
  const rest = await remainingKeyboard(admin, chatId, messageId, userId);
  await answerCallbackQuery(cb.id, res.ok ? "Feito!" : "Deu erro.");
  await editMessageText(
    chatId,
    messageId,
    `${
      res.ok
        ? `✅ Feito!${res.note ? `\n<i>${escapeHtml(res.note)}</i>` : ""}`
        : `❌ ${escapeHtml(res.error ?? "Não consegui fazer isso.")}`
    }${rest ? STILL_PENDING : ""}`,
    rest,
  );
  return userId;
}

/**
 * Reivindica a linha da proposta pra este toque, de forma atômica: o `update`
 * só bate se `consumed_at` ainda estiver nulo (`.is("consumed_at", null)`),
 * então dois toques concorrentes nunca reivindicam os dois — um vence, o
 * outro recebe `null` de volta e sabe que perdeu a corrida. Sem essa guarda,
 * ler `consumed_at` e depois gravá-lo são dois passos separados: dois
 * `callback_query` do mesmo botão (o Telegram não desabilita o botão sozinho)
 * passam os dois pela leitura antes de qualquer um gravar, e a ação roda em
 * dobro.
 */
async function claimPending(
  admin: ReturnType<typeof createAdminClient>,
  pendingId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("toube_pending_proposals")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", pendingId)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    logEvent({
      userId,
      eventType: "webhook",
      source: "telegram/toube",
      status: "error",
      messagePreview: error.message,
      metadata: { pending_id: pendingId, stage: "claim" },
    });
    return false;
  }
  return !!data;
}
