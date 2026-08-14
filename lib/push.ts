import { logEvent } from "@/lib/logger";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

type Admin = SupabaseClient<Database>;

/** O que o service worker recebe e transforma em notificação. */
export type PushPayload = {
  title: string;
  body: string;
  /** Pra onde o toque leva. */
  url: string;
  /** Agrupamento na bandeja. Sem ela, o service worker agrupa pela `url`. */
  tag?: string;
};

let configured = false;

/**
 * Guarda de PROCESSO (não por usuário) do aviso de VAPID ausente.
 *
 * Sem ela, um cron que varre N perfis registraria N linhas idênticas em
 * `app_logs` — o log vira spam e some no meio dele mesmo o que importa. Uma vez
 * por processo basta: a env não muda no meio da execução.
 */
let vapidAvisado = false;

/**
 * Configura o VAPID uma vez. Fora daqui ninguém toca nas chaves.
 * Sem as envs, o push simplesmente não existe — e isso NÃO é erro fatal: o
 * Telegram continua entregando. Por isso devolve boolean em vez de lançar.
 */
function ensureVapid(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return false;
  try {
    // `setVapidDetails` LANÇA com env malformada (subject sem `mailto:`, chave
    // truncada, espaço/quebra colada no valor ao copiar pra Vercel). Sem este
    // try, a exceção subia e morria no catch do notify.ts: o sintoma virava
    // "nenhum aparelho ativo" sem uma linha de log em lugar nenhum.
    webpush.setVapidDetails(subject.trim(), pub.trim(), priv.trim());
  } catch (err) {
    if (!vapidAvisado) {
      vapidAvisado = true;
      logEvent({
        eventType: "cron",
        source: "push",
        status: "error",
        messagePreview: err instanceof Error ? err.message : "VAPID invalido",
        metadata: {
          motivo: "vapid_invalido",
          // Formato, nunca o valor: a privada é segredo e a pública não ajuda no log.
          subjectPrefixo: subject.slice(0, 7),
          pubBytes: Buffer.from(pub.trim(), "base64url").length,
          privBytes: Buffer.from(priv.trim(), "base64url").length,
        },
      });
    }
    return false;
  }
  configured = true;
  return true;
}

/**
 * Envia pra TODOS os aparelhos do usuário. Devolve quantos receberam.
 *
 * Poda assinatura morta: quando alguém desinstala o app ou limpa o navegador, o
 * endpoint responde 404/410 PARA SEMPRE. Sem remover, cada cron gastaria
 * requisição com fantasma todo dia — o lixo só cresce.
 */
export async function sendPushToUser(
  admin: Admin,
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!ensureVapid()) {
    // Continua devolvendo 0 e deixando o Telegram entregar — só para de ser
    // mudo. Sem esse registro, três envs digitadas errado na Vercel derrubam
    // 100% do push pra sempre e o único sinal seria `sent: 0`.
    if (!vapidAvisado) {
      vapidAvisado = true;
      logEvent({
        userId,
        eventType: "cron",
        source: "push",
        status: "error",
        messagePreview: "VAPID nao configurado",
        metadata: { motivo: "vapid_ausente" },
      });
    }
    return 0;
  }

  const { data: subs, error: subsErr } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (subsErr) {
    logEvent({
      userId,
      eventType: "cron",
      source: "push",
      status: "error",
      messagePreview: subsErr.message,
    });
    return 0;
  }
  if (!subs?.length) return 0;

  const mortas: string[] = [];
  const entreguesIds: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        entreguesIds.push(s.id);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 = assinatura não existe mais. Qualquer outro código pode ser
        // transitório (rede, serviço fora) — nesses a assinatura fica.
        if (status === 404 || status === 410) {
          mortas.push(s.id);
        } else {
          // 401/403 (par VAPID trocado), 413, 429, 5xx e falha de rede caíam
          // aqui e sumiam. Registra SEM o endpoint e SEM p256dh/auth: são
          // material de criptografia, não vão pro log.
          logEvent({
            userId,
            eventType: "cron",
            source: "push",
            status: "error",
            messagePreview: err instanceof Error ? err.message : "falha no envio",
            metadata: { motivo: "envio_falhou", statusCode: status ?? null, endpointId: s.id },
          });
        }
      }
    }),
  );

  if (mortas.length) {
    // Poda que falha em silêncio = fantasma que volta a consumir requisição
    // todo dia, sem ninguém saber por quê.
    const { error: podaErr } = await admin.from("push_subscriptions").delete().in("id", mortas);
    if (podaErr) {
      logEvent({
        userId,
        eventType: "cron",
        source: "push",
        status: "error",
        messagePreview: podaErr.message,
        metadata: { motivo: "poda_falhou", quantas: mortas.length },
      });
    }
  }
  if (entreguesIds.length) {
    // Carimba só quem de fato recebeu — não o usuário inteiro, senão
    // assinatura que acabou de falhar mentiria "visto agora" pra quem lê a
    // lista de aparelhos.
    const { error: carimboErr } = await admin
      .from("push_subscriptions")
      .update({ last_ok_at: new Date().toISOString() })
      .in("id", entreguesIds);
    if (carimboErr) {
      logEvent({
        userId,
        eventType: "cron",
        source: "push",
        status: "error",
        messagePreview: carimboErr.message,
        metadata: { motivo: "carimbo_falhou", quantas: entreguesIds.length },
      });
    }
  }
  return entreguesIds.length;
}
