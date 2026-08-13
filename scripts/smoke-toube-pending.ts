// Smoke manual: node --env-file=.env.local --import ./scripts/dev-alias.mjs scripts/smoke-toube-pending.ts
// Precisa de SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL no ambiente.
// Usa SMOKE_USER_ID se existir; senão resolve o uuid do usuário de teste
// (SMOKE_USER_EMAIL ou teste@touvie.app) pelo admin do Auth.
//
// O que prova: com UMA LINHA POR PROPOSTA em toube_pending_proposals, duas
// propostas do MESMO turno (mesma mensagem do Telegram, mesmo message_id)
// reivindicam de forma independente. No formato antigo — o lote inteiro numa
// linha só — confirmar a primeira carimbava consumed_at da linha e a segunda
// ouvia "isso já foi feito" sobre algo que nunca rodou.
//
// Não chama a API do Telegram e não executa nenhuma ação: exercita só a camada
// de banco (insert, claim atômico, unclaim, expiração e a busca das irmãs que
// remonta o teclado). Apaga tudo o que cria.
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

const admin = createAdminClient();

async function resolveUserId(): Promise<string> {
  if (process.env.SMOKE_USER_ID) return process.env.SMOKE_USER_ID;
  const email = process.env.SMOKE_USER_EMAIL ?? "teste@touvie.app";
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`usuário ${email} não encontrado (defina SMOKE_USER_ID)`);
  return user.id;
}

const userId = await resolveUserId();
const chatId = "-1"; // chat_id inexistente de propósito: nada é enviado ao Telegram
const messageId = -424242; // mesma "mensagem" pras duas propostas do turno

const fail = (msg: string) => {
  console.error(`FALHOU: ${msg}`);
  process.exit(1);
};

/** Espelha o claimPending do webhook: só reivindica se consumed_at ainda é nulo. */
async function claim(id: string): Promise<boolean> {
  const { data, error } = await admin
    .from("toube_pending_proposals")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();
  if (error) fail(`claim(${id}) deu erro: ${error.message}`);
  return !!data;
}

/** Espelha o remainingKeyboard: irmãs ainda pendentes e no prazo desta mensagem. */
async function siblings(): Promise<string[]> {
  const { data, error } = await admin
    .from("toube_pending_proposals")
    .select("id")
    .eq("user_id", userId)
    .eq("chat_id", chatId)
    .eq("message_id", messageId)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) fail(`busca das irmãs deu erro: ${error.message}`);
  return (data ?? []).map((r) => r.id);
}

// ─── Turno com DUAS propostas (o cenário do bug) ────────────────────────────
const proposals = [
  { action: "lancar_transacao", args: { kind: "expense", amount_cents: 4000, titulo: "mercado" } },
  { action: "criar_lembrete", args: { mensagem: "pagar o aluguel", hora: "10:00" } },
];
const prepared = proposals.map((p) => ({ id: crypto.randomUUID(), proposal: p }));
const ids = prepared.map((x) => x.id);

const { error: insErr } = await admin.from("toube_pending_proposals").insert(
  prepared.map(({ id, proposal }) => ({
    id,
    user_id: userId,
    chat_id: chatId,
    proposals: [proposal] as unknown as Json,
  })),
);
if (insErr) fail(`insert das propostas: ${insErr.message}`);
const { error: mErr } = await admin
  .from("toube_pending_proposals")
  .update({ message_id: messageId })
  .in("id", ids);
if (mErr) fail(`update do message_id: ${mErr.message}`);
console.log(`inseridas ${ids.length} linhas (uma por proposta), message_id=${messageId}`);

const cbConfirm = `tb:${ids[0]}`;
const cbCancel = `tb:${ids[0]}:n`;
const cbDestroy = `tb:${ids[0]}:d`;
console.log(
  `callback_data: confirmar=${Buffer.byteLength(cbConfirm)}B, cancelar=${Buffer.byteLength(cbCancel)}B, destrutiva=${Buffer.byteLength(cbDestroy)}B (teto do Telegram: 64B)`,
);
if (Buffer.byteLength(cbDestroy) > 64) fail("callback_data estourou 64 bytes");

// 1. As duas aparecem como confirmáveis na mensagem.
const s0 = await siblings();
if (s0.length !== 2) fail(`esperava 2 propostas pendentes na mensagem, veio ${s0.length}`);
console.log("1. mensagem começa com 2 botões confirmáveis ✓");

// 2. Confirma a PRIMEIRA.
if (!(await claim(ids[0]))) fail("a primeira proposta não reivindicou");
console.log("2. proposta A reivindicada ✓");

// 3. A segunda continua confirmável (o teclado remontado mostra só ela).
const s1 = await siblings();
if (s1.length !== 1 || s1[0] !== ids[1]) fail(`depois de A, esperava só B pendente; veio ${s1}`);
console.log("3. depois de confirmar A, só B segue no teclado ✓");

// 4. Claim atômico: tocar de novo em A não reivindica (é o "isso já foi feito"
//    legítimo — a ação de A realmente rodou).
if (await claim(ids[0])) fail("A reivindicou duas vezes — o claim atômico regrediu");
console.log("4. segundo toque em A não reivindica (claim atômico intacto) ✓");

// 5. O CERNE: B reivindica normalmente, mesmo com A já consumida.
if (!(await claim(ids[1]))) fail("B não reivindicou depois de A — o bug do lote continua");
console.log("5. B reivindicou de forma independente ✓  ← a correção");

if ((await siblings()).length !== 0) fail("sobrou proposta pendente depois de A e B");
console.log("6. teclado vazio depois das duas ✓");

// 7. Unclaim (execução falhou): a proposta volta a ser confirmável.
const { error: unErr } = await admin
  .from("toube_pending_proposals")
  .update({ consumed_at: null })
  .eq("id", ids[1]);
if (unErr) fail(`unclaim: ${unErr.message}`);
const s2 = await siblings();
if (s2.length !== 1 || s2[0] !== ids[1]) fail("unclaim não devolveu B ao teclado");
if (!(await claim(ids[1]))) fail("B não reivindicou depois do unclaim");
console.log("7. unclaim devolve o botão e permite nova tentativa ✓");

// 8. expires_at: linha vencida não volta ao teclado.
const expiredId = crypto.randomUUID();
const { error: expErr } = await admin.from("toube_pending_proposals").insert({
  id: expiredId,
  user_id: userId,
  chat_id: chatId,
  message_id: messageId,
  proposals: [proposals[0]] as unknown as Json,
  expires_at: new Date(Date.now() - 60_000).toISOString(),
});
if (expErr) fail(`insert da vencida: ${expErr.message}`);
if ((await siblings()).length !== 0) fail("proposta vencida voltou ao teclado");
console.log("8. proposta vencida fica fora do teclado ✓");

// ─── Limpeza ────────────────────────────────────────────────────────────────
const { error: delErr } = await admin
  .from("toube_pending_proposals")
  .delete()
  .in("id", [...ids, expiredId]);
if (delErr) fail(`limpeza: ${delErr.message}`);
const { data: sobrou } = await admin
  .from("toube_pending_proposals")
  .select("id")
  .in("id", [...ids, expiredId]);
if (sobrou?.length) fail(`limpeza incompleta: ${sobrou.length} linha(s) sobraram`);

console.log("OK: duas propostas do mesmo turno confirmam de forma independente; nada sobrou.");
