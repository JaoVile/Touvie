// Diagnóstico local: testa se as chaves do Supabase estão funcionando.
// Não loga valores secretos, só status.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  const text = readFileSync(path, "utf8");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv("./.env.local");
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = env.SUPABASE_SERVICE_ROLE_KEY;

console.log("== CHECK 1: formato do .env.local ==");
console.log(" URL presente?        ", Boolean(url), url ? `(${url.length} chars, começa com: ${url.slice(0, 20)}…)` : "");
console.log(" ANON key presente?   ", Boolean(anon), anon ? `(${anon.length} chars, prefixo: ${anon.slice(0, 12)}…)` : "");
console.log(" SERVICE key presente?", Boolean(svc), svc ? `(${svc.length} chars, prefixo: ${svc.slice(0, 12)}…)` : "");

if (!url || !anon) {
  console.error("\n❌ Faltando URL ou ANON key no .env.local.");
  process.exit(1);
}

console.log("\n== CHECK 2: URL responde? ==");
try {
  const r = await fetch(url);
  console.log(" HTTP", r.status, r.statusText);
} catch (e) {
  console.error(" ❌ Erro:", e.message);
}

console.log("\n== CHECK 3: chamada com ANON key ==");
try {
  const supa = createClient(url, anon);
  const { error } = await supa.from("profiles").select("id").limit(0);
  if (error) {
    console.error(" ❌", error.message);
  } else {
    console.log(" ✅ Consulta executada (RLS bloqueou resultados como esperado — esperado sem user logado)");
  }
} catch (e) {
  console.error(" ❌ Exceção:", e.message);
}

console.log("\n== CHECK 4: listar usuários (precisa SERVICE role) ==");
if (!svc) {
  console.log(" (pulado — SERVICE key ausente)");
} else {
  try {
    const admin = createClient(url, svc, { auth: { persistSession: false } });
    const { data, error } = await admin.auth.admin.listUsers();
    if (error) {
      console.error(" ❌", error.message);
    } else {
      console.log(` ✅ ${data.users.length} usuário(s) cadastrado(s):`);
      for (const u of data.users) {
        console.log(`    - ${u.email}  | confirmado: ${u.email_confirmed_at ? "sim" : "NÃO"}  | id: ${u.id.slice(0, 8)}…`);
      }
    }
  } catch (e) {
    console.error(" ❌ Exceção:", e.message);
  }
}
