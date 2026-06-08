import { readFileSync } from "node:fs";
// Migração: popula contas recorrentes (bills), contas e saldo no Touvie.
// IDEMPOTENTE — pode rodar de novo sem duplicar.
// Dados ditados pelo vile em 2026-05-30. Ciclo inicial: junho/2026.
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv("./.env.local");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const reais = (r) => Math.round(r * 100);
const brl = (c) => `R$ ${(c / 100).toFixed(2)}`;

const { data: users } = await db.auth.admin.listUsers();
const uid = users.users[0].id;
console.log(`👤 ${users.users[0].email}\n`);

// --- 1. CONTAS (accounts) -------------------------------------------
// Nomes alinhados ao importador: "Mercado Pago" (checking), "Nubank Cartão" (credit).
// + "Nubank" (checking) como conta-de-contas do vile.
const wantAccounts = [
  { name: "Mercado Pago", kind: "checking", balance: 1460.0 }, // economias/dinheiro livre
  { name: "Nubank", kind: "checking", balance: 0.0 }, // conta-de-contas
  { name: "Nubank Cartão", kind: "credit", balance: 0.0 }, // fatura cartão
];
const { data: existingAccs } = await db
  .from("finance_accounts")
  .select("id,name,kind,balance_cents")
  .eq("user_id", uid);
const accByName = new Map((existingAccs ?? []).map((a) => [a.name.toLowerCase(), a]));

for (const a of wantAccounts) {
  const found = accByName.get(a.name.toLowerCase());
  if (found) {
    if (found.balance_cents !== reais(a.balance)) {
      await db
        .from("finance_accounts")
        .update({ balance_cents: reais(a.balance) })
        .eq("id", found.id);
      console.log(`🏦 atualizado saldo ${a.name}: ${brl(reais(a.balance))}`);
    } else {
      console.log(`🏦 ok (já existe): ${a.name} = ${brl(found.balance_cents)}`);
    }
  } else {
    await db
      .from("finance_accounts")
      .insert({ user_id: uid, name: a.name, kind: a.kind, balance_cents: reais(a.balance) });
    console.log(`🏦 criada conta: ${a.name} [${a.kind}] = ${brl(reais(a.balance))}`);
  }
}

// --- 2. CATEGORIAS (mapa nome -> id) --------------------------------
const { data: cats } = await db
  .from("finance_categories")
  .select("id,name,kind")
  .eq("user_id", uid)
  .eq("archived", false);
const catId = (name) => cats.find((c) => c.name === name && c.kind === "expense")?.id ?? null;

// --- 3. BILLS (contas recorrentes) — ciclo junho/2026 ---------------
const MES = "2026-06";
const bills = [
  { day: 1, title: "Alimentação (mercado)", amount: 150, cat: "Mercado" },
  { day: 1, title: "Transporte", amount: 250, cat: "Transporte" },
  { day: 5, title: "Meli+", amount: 11, cat: "Assinaturas" },
  { day: 5, title: "Internet / WiFi", amount: 50, cat: "Moradia" },
  { day: 7, title: "Galão de água", amount: 8, cat: "Moradia" },
  { day: 12, title: "Luz", amount: 100, cat: "Moradia" },
  { day: 21, title: "Galão de água", amount: 8, cat: "Moradia" },
  { day: 25, title: "Aluguel", amount: 400, cat: "Moradia" },
  { day: 27, title: "Claude (Anthropic)", amount: 110, cat: "Assinaturas" },
  { day: 27, title: "Academia", amount: 130, cat: "Saúde" },
  { day: 30, title: "Lavanderia", amount: 50, cat: "Outros gastos" },
];

// idempotência: pula se já existe bill com mesmo title+due_date
const { data: existingBills } = await db.from("bills").select("title,due_date").eq("user_id", uid);
const billKey = new Set((existingBills ?? []).map((b) => `${b.title}|${b.due_date}`));

let created = 0,
  total = 0;
for (const b of bills) {
  const due = `${MES}-${String(b.day).padStart(2, "0")}`;
  total += reais(b.amount);
  if (billKey.has(`${b.title}|${due}`)) {
    console.log(`📅 ok (já existe): ${due} ${b.title}`);
    continue;
  }
  const { error } = await db.from("bills").insert({
    user_id: uid,
    title: b.title,
    amount_cents: reais(b.amount),
    due_date: due,
    recurrence_rule: "monthly",
    category_id: catId(b.cat),
    notes: null,
  });
  if (error) {
    console.log(`❌ ${b.title}: ${error.message}`);
    continue;
  }
  console.log(`📅 criada: ${due} · ${b.title} · ${brl(reais(b.amount))} (${b.cat})`);
  created++;
}

console.log(`\n✅ ${created} conta(s) nova(s). Total recorrente do mês: ${brl(total)}`);
