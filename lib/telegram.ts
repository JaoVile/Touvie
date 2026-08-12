// Cliente direto da Telegram Bot API via fetch — sem dependência externa.
// Token vem de TELEGRAM_BOT_TOKEN. Webhook secret vem de TELEGRAM_WEBHOOK_SECRET.

const TG = "https://api.telegram.org";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN not set");
  return t;
}

function webhookSecret(): string {
  const s = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!s) throw new Error("TELEGRAM_WEBHOOK_SECRET not set");
  return s;
}

interface ApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

async function call<T>(method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${TG}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.ok) {
    throw new Error(`Telegram ${method}: ${json.description ?? res.statusText}`);
  }
  return json.result as T;
}

export interface BotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
}

export async function getMe(): Promise<BotInfo> {
  return call<BotInfo>("getMe");
}

export async function sendMessage(
  chatId: number | string,
  text: string,
  opts: { parseMode?: "Markdown" | "HTML"; silent?: boolean } = {},
): Promise<void> {
  await call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: opts.parseMode ?? "HTML",
    disable_notification: opts.silent ?? false,
    disable_web_page_preview: true,
  });
}

export async function setWebhook(url: string): Promise<void> {
  await call("setWebhook", {
    url,
    secret_token: webhookSecret(),
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
}

export async function deleteWebhook(): Promise<void> {
  await call("deleteWebhook", { drop_pending_updates: true });
}

export interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
}

export async function getWebhookInfo(): Promise<WebhookInfo> {
  return call<WebhookInfo>("getWebhookInfo");
}

export type InlineButton = { text: string; callback_data: string };
export type InlineKeyboard = { inline_keyboard: InlineButton[][] };

export interface TelegramCallbackQuery {
  id: string;
  data?: string;
  message?: { message_id: number; chat: { id: number } };
  from?: { id: number };
}

/** Mensagem com botões. Devolve o message_id pra dar pra editar depois. */
export async function sendMessageWithKeyboard(
  chatId: number,
  text: string,
  keyboard: InlineKeyboard,
): Promise<number | null> {
  const res = await call<{ message_id?: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
  return res.message_id ?? null;
}

/** Troca o texto de uma mensagem já enviada. `keyboard` ausente REMOVE os botões. */
export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  await call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup: keyboard ?? { inline_keyboard: [] },
  });
}

/** Mata o "relógio" girando no botão. Obrigatório após todo callback_query. */
export async function answerCallbackQuery(id: string, text?: string): Promise<void> {
  await call("answerCallbackQuery", { callback_query_id: id, text });
}

/** "digitando…" — sem isso o silêncio de 10s parece travamento. */
export async function sendChatAction(chatId: number, action = "typing"): Promise<void> {
  await call("sendChatAction", { chat_id: chatId, action });
}

// Tipos mínimos do payload de webhook que usamos
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number; type: string };
    text?: string;
  };
  callback_query?: TelegramCallbackQuery;
}

export const WEBHOOK_SECRET_HEADER = "x-telegram-bot-api-secret-token";

export function verifyWebhookSecret(provided: string | null): boolean {
  if (!provided) return false;
  return provided === webhookSecret();
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
