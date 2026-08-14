// Diagnóstico: por que o push não chegou?
// node --env-file=.env.local --import ./scripts/dev-alias.mjs scripts/diag-push.ts
// Somente leitura — não insere, não apaga, não envia.
import { createAdminClient } from "@/lib/supabase/admin";

const admin = createAdminClient();

console.log("=== 1. envs VAPID (neste ambiente local) ===");
for (const k of ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]) {
  const v = process.env[k];
  console.log(`  ${k}: ${v ? `presente (${v.length} chars)` : "❌ AUSENTE"}`);
}

console.log("\n=== 2. assinaturas registradas ===");
const { data: subs, error: subsErr } = await admin
  .from("push_subscriptions")
  .select("id, user_id, endpoint, user_agent, created_at, last_ok_at")
  .order("created_at", { ascending: false });
if (subsErr) console.log("  erro:", subsErr.message);
else if (!subs?.length)
  console.log("  ❌ NENHUMA assinatura na tabela — o registro nunca chegou ao banco");
else
  for (const s of subs) {
    console.log(
      `  ${s.created_at} · user=${s.user_id.slice(0, 8)} · ${s.endpoint.slice(0, 45)}… · ok=${s.last_ok_at ?? "nunca"}`,
    );
    console.log(`     UA: ${(s.user_agent ?? "?").slice(0, 90)}`);
  }

console.log("\n=== 3. preferências de canal ===");
const { data: profs, error: pErr } = await admin
  .from("profiles")
  .select("id, notify_push, notify_telegram, telegram_chat_id");
if (pErr) console.log("  erro:", pErr.message);
else
  for (const p of profs ?? [])
    console.log(
      `  user=${p.id.slice(0, 8)} · push=${p.notify_push} · telegram=${p.notify_telegram} · chat_id=${p.telegram_chat_id ?? "—"}`,
    );

console.log("\n=== 4. app_logs de push (últimos 20) ===");
const { data: logs, error: lErr } = await admin
  .from("app_logs")
  .select("created_at, source, status, message_preview, metadata")
  .eq("source", "push")
  .order("created_at", { ascending: false })
  .limit(20);
if (lErr) console.log("  erro:", lErr.message);
else if (!logs?.length)
  console.log("  (nenhum log de push — o caminho de envio nunca foi exercitado)");
else
  for (const l of logs)
    console.log(
      `  ${l.created_at} [${l.status}] ${l.message_preview} ${JSON.stringify(l.metadata)}`,
    );

console.log("\n=== 5. app_logs recentes de qualquer fonte (últimos 15) ===");
const { data: all } = await admin
  .from("app_logs")
  .select("created_at, source, status, message_preview")
  .order("created_at", { ascending: false })
  .limit(15);
for (const l of all ?? [])
  console.log(`  ${l.created_at} [${l.source}/${l.status}] ${l.message_preview}`);
