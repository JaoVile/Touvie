// Smoke manual: node --env-file=.env.local --import ./scripts/dev-alias.mjs scripts/smoke-notify.ts
//
// Verifica o LEQUE do lado do PUSH usando a poda como observável: o usuário de
// teste não tem assinatura real, então "push == 0" sozinho não discrimina nada
// (sairia 0 mesmo se o `if (prof.notify_push)` inteiro sumisse do código).
// Em vez disso inserimos uma assinatura MORTA (endpoint sintético que sempre
// responde 404, chave P-256 real — mesmo truque de
// scripts/smoke-push-prune.ts) e observamos se ela foi PODADA:
//   - notify_push=true  → sendPushToUser É chamado → o 404 poda a assinatura.
//   - notify_push=false → sendPushToUser NÃO é chamado → a assinatura sobrevive.
// Podada/sobreviveu é o que prova que a preferência foi respeitada de fato.
//
// O lado do TELEGRAM NÃO tem cobertura automatizada aqui. O usuário de teste
// não tem telegram_chat_id, e notifyUser curto-circuita em
// `prof.notify_telegram && prof.telegram_chat_id` — ou seja, sendMessage
// nunca seria chamado neste ambiente independente do valor de
// notify_telegram, então qualquer asserção sobre "o Telegram respeitou a
// preferência" passaria por construção (o mesmo problema que este script
// tinha do lado do push antes da correção). Discriminar de verdade exigiria
// um chat_id de teste real e mandar mensagem de verdade, o que não fazemos em
// smoke. O que este script prova do lado Telegram é só que o log
// "sem_destino" reflete o estado de notify_telegram/tem_chat_id no momento —
// não que o envio acontece.
//
// fail() LANÇA (não process.exit): assinatura sintética já pode estar
// inserida no banco real quando um passo do meio falha, e process.exit()
// não desenrola try/finally — pularia a limpeza e deixaria linha órfã em
// push_subscriptions. O catch no topo captura, marca a saída como falha
// (process.exitCode) e deixa o finally rodar de verdade.
import { createECDH, randomBytes } from "node:crypto";
import { notifyUser } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

const admin = createAdminClient();

const fail = (msg: string): never => {
  throw new Error(msg);
};

// Assinatura MORTA: endpoint sintético (sempre 404) + chave P-256 REAL, pra a
// criptografia do web-push passar e o erro vir da rede (404), não de uma
// chave inventada que estouraria antes de qualquer request.
function novaAssinaturaMorta() {
  const endpoint = `https://fcm.googleapis.com/fcm/send/SMOKE-NOTIFY-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const p256dh = ecdh.getPublicKey().toString("base64url");
  const auth = randomBytes(16).toString("base64url");
  return { endpoint, p256dh, auth };
}

async function limparAssinatura(endpoint: string) {
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

let falhas = 0;
const assinaturasParaLimpar: string[] = [];
let userId: string | null = null;
let original: { notify_push: boolean; notify_telegram: boolean } | null = null;

try {
  const { data: users, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) fail(`listUsers: ${listErr.message}`);
  const u = users?.users.find((x) => x.email === "teste@touvie.app");
  if (!u) fail("usuário de teste teste@touvie.app não existe");
  const uid = u!.id;
  userId = uid;

  const { data: orig, error: origErr } = await admin
    .from("profiles")
    .select("notify_push, notify_telegram")
    .eq("id", uid)
    .single();
  if (origErr || !orig) fail(`leitura das preferências originais: ${origErr?.message}`);
  original = orig;

  async function setPrefs(push: boolean, telegram: boolean) {
    const { error } = await admin
      .from("profiles")
      .update({ notify_push: push, notify_telegram: telegram })
      .eq("id", uid);
    if (error) fail(`update prefs (push=${push}, telegram=${telegram}): ${error.message}`);
  }

  async function inserirAssinatura(endpoint: string, p256dh: string, auth: string) {
    const { error } = await admin
      .from("push_subscriptions")
      .insert({ user_id: uid, endpoint, p256dh, auth, user_agent: "smoke-notify" });
    if (error) fail(`insert assinatura: ${error.message}`);
  }

  async function assinaturaExiste(endpoint: string): Promise<boolean> {
    const { data, error } = await admin
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", endpoint)
      .maybeSingle();
    if (error) fail(`select assinatura: ${error.message}`);
    return Boolean(data);
  }

  // Caso A: notify_push=true → push É tentado → 404 sintético → assinatura
  // PODADA. Sumir prova que sendPushToUser rodou.
  const a = novaAssinaturaMorta();
  assinaturasParaLimpar.push(a.endpoint);
  await inserirAssinatura(a.endpoint, a.p256dh, a.auth);
  await setPrefs(true, false);
  const rA = await notifyUser(admin, uid, { text: "smoke-notify-a", url: "/" });
  const podada = !(await assinaturaExiste(a.endpoint));
  const okA = rA.push === 0 && podada;
  if (!okA) falhas++;
  console.log(
    `notify_push=true  → ${JSON.stringify(rA)}, assinatura podada=${podada} ${okA ? "✓" : "✗"}`,
  );

  // Caso B: notify_push=false → push NÃO é tentado → a assinatura NOVA
  // sobrevive intacta. Sobreviver prova que sendPushToUser NÃO rodou.
  const b = novaAssinaturaMorta();
  assinaturasParaLimpar.push(b.endpoint);
  await inserirAssinatura(b.endpoint, b.p256dh, b.auth);
  await setPrefs(false, false);
  const rB = await notifyUser(admin, uid, { text: "smoke-notify-b", url: "/" });
  const sobreviveu = await assinaturaExiste(b.endpoint);
  const okB = rB.push === 0 && sobreviveu;
  if (!okB) falhas++;
  console.log(
    `notify_push=false → ${JSON.stringify(rB)}, assinatura sobreviveu=${sobreviveu} ${okB ? "✓" : "✗"}`,
  );

  // Nos dois casos acima notify_telegram=false e o usuário de teste não tem
  // chat_id, então os dois deviam ter gravado "sem_destino". logEvent é
  // fire-and-forget (não é esperado por notifyUser) — dá uma folga curta pro
  // insert do log terminar antes de consultar, senão a checagem corre risco
  // de rodar antes da escrita.
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Confere que os 2 logs mais recentes de source=notify batem com o motivo e
  // refletem o notify_push do respectivo caso.
  const { data: logs, error: logsErr } = await admin
    .from("app_logs")
    .select("status, metadata")
    .eq("source", "notify")
    .order("created_at", { ascending: false })
    .limit(2);
  if (logsErr) fail(`select app_logs: ${logsErr.message}`);
  const [logB, logA] = logs ?? [];
  const metaA = logA?.metadata as { motivo?: string; notify_push?: boolean } | null;
  const metaB = logB?.metadata as { motivo?: string; notify_push?: boolean } | null;
  const logsOk =
    logA?.status === "warning" &&
    metaA?.motivo === "sem_destino" &&
    metaA?.notify_push === true &&
    logB?.status === "warning" &&
    metaB?.motivo === "sem_destino" &&
    metaB?.notify_push === false;
  if (!logsOk) falhas++;
  console.log(
    `log "sem_destino" bate com os 2 casos: ${JSON.stringify(logs)} ${logsOk ? "✓" : "✗"}`,
  );
} catch (err) {
  console.error(`FALHOU: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  // Limpeza defensiva — roda mesmo se algo acima falhar/lançar — inclusive a
  // restauração das preferências originais, senão o próximo teste herda.
  for (const endpoint of assinaturasParaLimpar) {
    await limparAssinatura(endpoint);
  }
  if (userId && original) {
    await admin
      .from("profiles")
      .update({ notify_push: original.notify_push, notify_telegram: original.notify_telegram })
      .eq("id", userId);
  }
}

if (process.exitCode !== 1) {
  if (falhas === 0) {
    console.log(
      '\nOK: push respeita notify_push (poda=tentado, sobrevivência=não-tentado); log "sem_destino" bate. Telegram sem cobertura automatizada aqui (ver cabeçalho).',
    );
  } else {
    console.log(`\nFALHOU: ${falhas}`);
    process.exitCode = 1;
  }
}
