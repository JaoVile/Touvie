// Importa extratos REAIS para o Touvie (Supabase) via service role.
// IDEMPOTENTE — dedup por external_ref (índice único user_id+external_ref).
//
// Lida com dois formatos que a tela de importar do app ainda NÃO lê:
//   • Nubank NuConta (extrato da conta): "Data,Valor,Identificador,Descrição"
//     vírgula, decimal com PONTO, data DD/MM/AAAA. → conta "Nubank".
//   • Mercado Pago (extrato): cabeçalho RELEASE_DATE;...;TRANSACTION_NET_AMOUNT
//     ponto-e-vírgula, decimal BR (vírgula), data DD-MM-AAAA. → conta "Mercado Pago".
//
// MP é CURADO: pula movimento interno de caixinha ("Dinheiro reservado/retirado"),
// "Rendimentos" de centavos e pares pagamento+reembolso que se anulam (mesmo
// REFERENCE_ID, soma zero). Nubank entra inteiro.
//
// Uso: node scripts/finance-import.mjs <nubank.csv> <mercadopago.csv>
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv("./.env.local");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const brl = (c) => `R$ ${(c / 100).toFixed(2)}`;

const [nubankPath, mpPath] = process.argv.slice(2);

// ─── categorização leve (resto fica nulo p/ editar depois) ──────────
const GUESS = [
  { re: /99 tecnologia|uber|99pop|cabify|combustivel|posto /i, cat: "Transporte" },
  { re: /lavanderia|nelma maria/i, cat: "Outros gastos" },
  { re: /tim s a|claro|vivo|internet|wifi/i, cat: "Moradia" },
  { re: /hamburgueria|restaurante|lanche|padaria|ifood|cabral distribuidora/i, cat: "Alimentação" },
  { re: /google brasil|netflix|spotify|meli|amazon prime/i, cat: "Assinaturas" },
  { re: /maxima saude|farmacia|drogasil|hospital|clinica/i, cat: "Saúde" },
];
const guessExpenseCat = (desc) => GUESS.find((g) => g.re.test(desc))?.cat ?? null;
const guessIncomeCat = (desc) => (/atomos/i.test(desc) ? "Salário" : null);

// ─── parsers ────────────────────────────────────────────────────────
function parseNubank(text) {
  const lines = text.replace(/^﻿/, "").replace(/\r/g, "").split("\n").filter(Boolean);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 4) continue;
    const [rawDate, rawVal, id] = parts;
    const desc = parts.slice(3).join(",").trim();
    const m = rawDate.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) continue;
    const cents = Math.round(Number.parseFloat(rawVal.trim()) * 100);
    if (!Number.isFinite(cents) || cents === 0 || !id?.trim()) continue;
    rows.push({
      occurred_on: `${m[3]}-${m[2]}-${m[1]}`,
      description: desc,
      amount_cents: Math.abs(cents),
      kind: cents > 0 ? "income" : "expense",
      external_ref: `nu:${id.trim()}`,
    });
  }
  return rows;
}

function parseBRL(raw) {
  return Math.round(Number.parseFloat(raw.trim().replace(/\./g, "").replace(",", ".")) * 100);
}

function parseMercadoPago(text) {
  const lines = text.replace(/^﻿/, "").replace(/\r/g, "").split("\n");
  const headerIdx = lines.findIndex((l) => /RELEASE_DATE/i.test(l) && /AMOUNT/i.test(l));
  if (headerIdx < 0) return [];

  const raw = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    if (cols.length < 4) continue;
    const [rawDate, type, refId, rawVal] = cols.map((c) => c.trim());
    const m = rawDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!m) continue;
    const cents = parseBRL(rawVal);
    if (!Number.isFinite(cents) || cents === 0) continue;
    raw.push({ date: `${m[3]}-${m[2]}-${m[1]}`, type, refId, cents });
  }

  // pares que se anulam (mesmo REFERENCE_ID, soma líquida zero) → fora
  const byRef = new Map();
  for (const r of raw) byRef.set(r.refId, (byRef.get(r.refId) ?? 0) + r.cents);

  const rows = [];
  for (const r of raw) {
    const t = r.type;
    if (/^Rendimentos/i.test(t)) continue; // juros de centavos
    if (/^Dinheiro (reservado|retirado)/i.test(t)) continue; // caixinha interna
    if (byRef.get(r.refId) === 0) continue; // pagamento + reembolso anulado
    rows.push({
      occurred_on: r.date,
      description: t,
      amount_cents: Math.abs(r.cents),
      kind: r.cents > 0 ? "income" : "expense",
      external_ref: `mp:${r.refId}`,
    });
  }
  return rows;
}

// ─── conta por nome (cria se faltar) ────────────────────────────────
async function accountId(uid, name, kind) {
  const { data } = await db.from("finance_accounts").select("id").eq("user_id", uid).ilike("name", name).maybeSingle();
  if (data?.id) return data.id;
  const { data: created } = await db
    .from("finance_accounts")
    .insert({ user_id: uid, name, kind, balance_cents: 0 })
    .select("id")
    .single();
  return created?.id ?? null;
}

async function importInto(uid, rows, accId, cats) {
  if (rows.length === 0) return { imported: 0, skipped: 0 };
  const refs = rows.map((r) => r.external_ref);
  const { data: existing } = await db
    .from("transactions")
    .select("external_ref")
    .eq("user_id", uid)
    .in("external_ref", refs);
  const seen = new Set((existing ?? []).map((r) => r.external_ref));
  const fresh = rows.filter((r) => !seen.has(r.external_ref));
  const catId = (name, kind) => cats.find((c) => c.name === name && c.kind === kind)?.id ?? null;

  const payload = fresh.map((r) => {
    const catName = r.kind === "income" ? guessIncomeCat(r.description) : guessExpenseCat(r.description);
    return {
      user_id: uid,
      account_id: accId,
      category_id: catName ? catId(catName, r.kind) : null,
      amount_cents: r.amount_cents,
      kind: r.kind,
      occurred_on: r.occurred_on,
      description: r.description,
      is_recurring: false,
      external_ref: r.external_ref,
    };
  });
  if (payload.length) {
    const { error } = await db.from("transactions").insert(payload);
    if (error) throw new Error(error.message);
  }
  return { imported: fresh.length, skipped: rows.length - fresh.length };
}

// ─── run ────────────────────────────────────────────────────────────
const { data: users } = await db.auth.admin.listUsers();
const uid = users.users[0].id;
console.log(`👤 ${users.users[0].email}\n`);

const { data: cats } = await db
  .from("finance_categories")
  .select("id,name,kind")
  .eq("user_id", uid)
  .eq("archived", false);

let grandIn = 0;
let grandOut = 0;
function tally(rows, label) {
  const inc = rows.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount_cents, 0);
  const exp = rows.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount_cents, 0);
  grandIn += inc;
  grandOut += exp;
  console.log(`   ${label}: ${rows.length} lançs · +${brl(inc)} entrada / -${brl(exp)} saída`);
}

if (nubankPath) {
  const rows = parseNubank(readFileSync(nubankPath, "utf8"));
  tally(rows, "Nubank (NuConta)");
  const acc = await accountId(uid, "Nubank", "checking");
  const r = await importInto(uid, rows, acc, cats);
  console.log(`   → conta "Nubank": ${r.imported} importadas, ${r.skipped} já existiam\n`);
}

if (mpPath) {
  const rows = parseMercadoPago(readFileSync(mpPath, "utf8"));
  tally(rows, "Mercado Pago (curado)");
  const acc = await accountId(uid, "Mercado Pago", "checking");
  const r = await importInto(uid, rows, acc, cats);
  console.log(`   → conta "Mercado Pago": ${r.imported} importadas, ${r.skipped} já existiam\n`);
}

console.log(`📊 TOTAL importável: +${brl(grandIn)} entrada / -${brl(grandOut)} saída`);
