// Inspeção READ-ONLY do estado financeiro no Supabase.
// Não escreve nada. Mostra contas, categorias, recorrentes e bills do user.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  const text = readFileSync(path, "utf8");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv("./.env.local");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: users } = await admin.auth.admin.listUsers();
if (!users.users.length) {
  console.log("Nenhum usuário cadastrado.");
  process.exit(0);
}
const u = users.users[0];
const uid = u.id;
console.log(`👤 Usuário: ${u.email} (${uid.slice(0, 8)}…)\n`);

const brl = (c) => `R$ ${(c / 100).toFixed(2)}`;

const [accs, cats, recs, bills, txCount] = await Promise.all([
  admin.from("finance_accounts").select("id,name,kind,balance_cents,archived").eq("user_id", uid),
  admin.from("finance_categories").select("id,name,kind,emoji,archived").eq("user_id", uid),
  admin.from("transactions").select("description,amount_cents,kind,recurrence_rule,reminder_enabled").eq("user_id", uid).eq("is_recurring", true),
  admin.from("bills").select("title,amount_cents,due_date,paid_at,recurrence_rule").eq("user_id", uid).order("due_date"),
  admin.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", uid),
]);

console.log(`🏦 CONTAS (${accs.data?.length ?? 0}):`);
for (const a of accs.data ?? []) console.log(`   ${a.archived ? "🗄️ " : ""}${a.name} [${a.kind}] = ${brl(a.balance_cents)}`);

console.log(`\n🏷️  CATEGORIAS (${cats.data?.length ?? 0}):`);
for (const c of cats.data ?? []) console.log(`   ${c.emoji ?? ""} ${c.name} (${c.kind})${c.archived ? " 🗄️" : ""}`);

console.log(`\n🔁 RECORRENTES (${recs.data?.length ?? 0}):`);
for (const r of recs.data ?? []) console.log(`   ${r.kind === "income" ? "➕" : "➖"} ${r.description ?? "—"} ${brl(r.amount_cents)} [${r.recurrence_rule ?? "?"}]${r.reminder_enabled ? " 🔔" : ""}`);

console.log(`\n📅 BILLS / contas a vencer (${bills.data?.length ?? 0}):`);
for (const b of bills.data ?? []) console.log(`   ${b.paid_at ? "✅" : "⬜"} ${b.due_date} · ${b.title} · ${brl(b.amount_cents)}${b.recurrence_rule ? ` [${b.recurrence_rule}]` : ""}`);

console.log(`\n🧾 Total de transações (todas): ${txCount.count ?? 0}`);
