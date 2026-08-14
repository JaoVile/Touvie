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
  /**
   * Chave de agrupamento da notificação nativa. Sem ela, o service worker
   * agrupa pela `url` — certo pros crons de horário (não empilha o mesmo
   * lembrete de sempre), errado pro sweep, onde vários lembretes distintos
   * compartilham "/notificacoes" e um sobrescreveria o outro na bandeja.
   */
  tag?: string;
};

/** Teto do corpo do push. Também mantém o payload longe do limite de ~4KB. */
const PUSH_BODY_MAX = 300;

/**
 * Converte o texto (que é HTML de Telegram) em corpo de notificação nativa.
 *
 * Sem isso a pessoa lê literalmente `⏰ <b>BATER PONTO</b>` na tela do celular,
 * e `&amp;` no lugar de `&` — vale pras seis notificações, ou seja, 100% do
 * canal novo. O texto do Telegram continua HTML intacto; a transformação é só
 * do lado do push.
 */
function toPushBody(text: string): string {
  const limpo = text
    .replace(/<[^>]+>/g, "") // tira as tags (mesmo idioma do lib/logger.ts)
    // Desescapa o que o escapeHtml produziu. `&amp;` vai por ÚLTIMO: antes dos
    // outros, ele re-desescaparia o que acabou de gerar (`&amp;lt;` → `<`).
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n") // colapsa quebras múltiplas
    .trim();
  if (limpo.length <= PUSH_BODY_MAX) return limpo;
  // O corte é por unidade UTF-16: se cair no meio de um par substituto, sobra
  // metade de emoji (vira "�" na bandeja) — e os templates são cheios deles.
  const cortado = limpo
    .slice(0, PUSH_BODY_MAX)
    .replace(/[\uD800-\uDBFF]$/, "")
    .trimEnd();
  return `${cortado}…`;
}

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
  const { data: prof, error: profErr } = await admin
    .from("profiles")
    .select("telegram_chat_id, notify_push, notify_telegram")
    .eq("id", userId)
    .maybeSingle();

  const result: NotifyResult = { push: 0, telegram: false };

  if (profErr) {
    // "sem perfil" (usuário não existe) e "consulta falhou" (banco/rede) não
    // podem colapsar no mesmo retorno mudo — é a mesma classe de bug corrigida
    // em lib/push.ts. Motivo distinto de "sem_destino": aqui nem chegamos a
    // decidir canal nenhum.
    logEvent({
      userId,
      eventType: "cron",
      source: "notify",
      status: "error",
      messagePreview: profErr.message,
      metadata: { motivo: "perfil_indisponivel" },
    });
    return result;
  }
  if (!prof) return result;

  const tarefas: Promise<unknown>[] = [];

  if (prof.notify_push) {
    tarefas.push(
      sendPushToUser(admin, userId, {
        title: input.title ?? "Touvie",
        body: toPushBody(input.text),
        url: input.url ?? "/",
        ...(input.tag ? { tag: input.tag } : {}),
      })
        .then((n) => {
          result.push = n;
        })
        .catch((err) => {
          // Não derruba o Telegram — mas NÃO fica mudo. Este catch engolia
          // qualquer exceção do push (ex.: setVapidDetails lançando com env
          // malformada na Vercel), e o sintoma era "nenhum aparelho ativo"
          // sem uma linha de log em lugar nenhum.
          logEvent({
            userId,
            eventType: "cron",
            source: "push",
            status: "error",
            messagePreview: err instanceof Error ? err.message : "push lancou",
            metadata: { motivo: "push_lancou" },
          });
        }),
    );
  }

  if (prof.notify_telegram && prof.telegram_chat_id) {
    tarefas.push(
      sendMessage(prof.telegram_chat_id, input.text)
        .then(() => {
          result.telegram = true;
        })
        .catch((err) => {
          // Idem: um canal caindo não leva o outro junto, mas some do log nunca.
          logEvent({
            userId,
            eventType: "cron",
            source: "telegram",
            status: "error",
            messagePreview: err instanceof Error ? err.message : "telegram lancou",
            metadata: { motivo: "telegram_lancou" },
          });
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
