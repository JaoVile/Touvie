// Smoke manual: node --env-file=.env.local --import ./scripts/dev-alias.mjs scripts/smoke-push-prune.ts
//
// Insere uma assinatura com endpoint INVÁLIDO (aponta pro nada) mas com um par
// de chaves P-256 REAL — se a chave não for um ponto válido da curva, o
// web-push estoura na criptografia antes de tocar a rede (statusCode
// undefined) e a poda nunca é exercitada. Aqui a criptografia passa, o POST
// vai pro endpoint inexistente, volta 404/410, e confirmamos que a linha foi
// removida. Não depende de push real funcionar — o ponto é o caminho de falha
// de rede, não o de criptografia.
import { createECDH, randomBytes } from "node:crypto";
import { sendPushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

const admin = createAdminClient();

const fail = (msg: string): never => {
  throw new Error(msg);
};

const { data: users, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
if (listErr) fail(`listUsers: ${listErr.message}`);
const u = users?.users.find((x) => x.email === "teste@touvie.app");
if (!u) fail("usuário de teste teste@touvie.app não existe");

// Endpoint sintético que o serviço de push não conhece → 404/410.
const endpoint = `https://fcm.googleapis.com/fcm/send/SMOKE-${Date.now()}`;

// Par de chaves P-256 REAL (ponto válido da curva), pra criptografia do
// web-push passar e o erro vir de fato da rede (404/410), não de uma chave
// inventada que faria estourar antes de qualquer request.
const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
const p256dh = ecdh.getPublicKey().toString("base64url");
const auth = randomBytes(16).toString("base64url");

async function cleanup() {
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

try {
  const { error: insErr } = await admin
    .from("push_subscriptions")
    .insert({ user_id: u!.id, endpoint, p256dh, auth, user_agent: "smoke" });
  if (insErr) fail(`insert: ${insErr.message}`);
  console.log("assinatura falsa inserida (chave P-256 real, endpoint inexistente)");

  const entregues = await sendPushToUser(admin, u!.id, { title: "t", body: "b", url: "/" });
  console.log(`entregues: ${entregues} (esperado 0)`);

  const { data: resta } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (entregues !== 0) fail("não deveria entregar");
  if (resta) fail("assinatura morta não foi podada");
  console.log("OK: 0 entregues e assinatura morta removida");
} catch (err) {
  console.error(`FALHOU: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  // Limpeza defensiva: mesmo se algo acima falhar/lançar, não deixa lixo.
  await cleanup();
}
