import { logEvent } from "@/lib/logger";
import { sendPushToUser } from "@/lib/push";
import type { Database } from "@/lib/supabase/types";
import { sendMessage } from "@/lib/telegram";
import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient<Database>;

export type NotifyInput = {
  /** Texto da notificação. No Telegram vai como HTML; no push, como corpo. */
  text: string;
  /** Título da notificação nativa. Sem ele, "Touvie". */
  title?: string;
  /** Pra onde o toque leva. Default "/". */
  url?: string;
};

export type NotifyResult = {
  /** Quantos aparelhos receberam push. */
  push: number;
  /** Entregue no chat do Telegram? */
  telegram: boolean;
};

/**
 * Entrega uma notificação pelos canais que a pessoa escolheu.
 *
 * É a ÚNICA coisa que os crons conhecem — eles não sabem mais que Telegram
 * existe. Antes disso, cada um dos seis repetia a busca do telegram_chat_id e
 * chamava o bot direto; qualquer canal novo exigiria mexer nos seis.
 *
 * A `url` é decisão de quem chama: o cron de treino manda "/treino", o de
 * finanças manda "/financas". Sem isso toda notificação abriria o dashboard e o
 * toque perderia o sentido.
 */
export async function notifyUser(
  admin: Admin,
  userId: string,
  input: NotifyInput,
): Promise<NotifyResult> {
  const { data: prof } = await admin
    .from("profiles")
    .select("telegram_chat_id, notify_push, notify_telegram")
    .eq("id", userId)
    .maybeSingle();

  const result: NotifyResult = { push: 0, telegram: false };
  if (!prof) return result;

  const tarefas: Promise<unknown>[] = [];

  if (prof.notify_push) {
    tarefas.push(
      sendPushToUser(admin, userId, {
        title: input.title ?? "Touvie",
        body: input.text,
        url: input.url ?? "/",
      })
        .then((n) => {
          result.push = n;
        })
        .catch(() => {
          /* falha de push não pode derrubar o Telegram */
        }),
    );
  }

  if (prof.notify_telegram && prof.telegram_chat_id) {
    tarefas.push(
      sendMessage(prof.telegram_chat_id, input.text)
        .then(() => {
          result.telegram = true;
        })
        .catch(() => {
          /* idem: um canal caindo não leva o outro junto */
        }),
    );
  }

  await Promise.all(tarefas);

  // Nenhum destino é a falha SILENCIOSA mais provável — e hoje ela não deixa
  // rastro nenhum. Registrar aqui é o que responde "não chegou, por quê?".
  if (result.push === 0 && !result.telegram) {
    logEvent({
      userId,
      eventType: "cron",
      source: "notify",
      status: "warning",
      messagePreview: input.text.slice(0, 40),
      metadata: {
        motivo: "sem_destino",
        notify_push: prof.notify_push,
        notify_telegram: prof.notify_telegram,
        tem_chat_id: Boolean(prof.telegram_chat_id),
      },
    });
  }

  return result;
}
