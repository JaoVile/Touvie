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
};

let configured = false;

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
  webpush.setVapidDetails(subject, pub, priv);
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
  if (!ensureVapid()) return 0;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
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
        if (status === 404 || status === 410) mortas.push(s.id);
      }
    }),
  );

  if (mortas.length) {
    await admin.from("push_subscriptions").delete().in("id", mortas);
  }
  if (entreguesIds.length) {
    // Carimba só quem de fato recebeu — não o usuário inteiro, senão
    // assinatura que acabou de falhar mentiria "visto agora" pra quem lê a
    // lista de aparelhos.
    await admin
      .from("push_subscriptions")
      .update({ last_ok_at: new Date().toISOString() })
      .in("id", entreguesIds);
  }
  return entreguesIds.length;
}
