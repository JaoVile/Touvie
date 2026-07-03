// Portão de paridade de i18n: garante que pt-BR.json e en.json tenham EXATAMENTE
// o mesmo conjunto de chaves (recursivo). Toda string visível vive nos dois
// idiomas (convenção do projeto) — este script pega o esquecido antes do commit.
//
// Uso:
//   node scripts/check-i18n.mjs        # checa; sai !=0 se houver divergência
//   pnpm check:i18n
//
// Determinístico e sem dependências: mais barato e confiável que um agente pra isso.
// Também acusa valor vazio ("") — chave existe mas ninguém traduziu.

import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "messages");
// A locale de referência é a fonte da verdade das chaves; as demais devem casar.
const BASE = "pt-BR";
const LOCALES = ["pt-BR", "en"];

// Achata { a: { b: "x" } } → { "a.b": "x" } pra comparar caminhos de chave.
function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

async function load(locale) {
  const raw = await readFile(path.join(DIR, `${locale}.json`), "utf8");
  return flatten(JSON.parse(raw));
}

async function main() {
  const maps = {};
  for (const loc of LOCALES) {
    try {
      maps[loc] = await load(loc);
    } catch (e) {
      console.error(`✗ Não consegui ler messages/${loc}.json — ${e.message}`);
      process.exit(1);
    }
  }

  const baseKeys = new Set(Object.keys(maps[BASE]));
  let problems = 0;

  for (const loc of LOCALES) {
    if (loc === BASE) continue;
    const keys = new Set(Object.keys(maps[loc]));

    const missing = [...baseKeys].filter((k) => !keys.has(k)).sort();
    const extra = [...keys].filter((k) => !baseKeys.has(k)).sort();

    if (missing.length) {
      problems += missing.length;
      console.error(`\n✗ ${missing.length} chave(s) em ${BASE} faltando em ${loc}:`);
      for (const k of missing) console.error(`    ${k}`);
    }
    if (extra.length) {
      problems += extra.length;
      console.error(`\n✗ ${extra.length} chave(s) em ${loc} que não existem em ${BASE}:`);
      for (const k of extra) console.error(`    ${k}`);
    }
  }

  // Valores vazios em qualquer locale (chave existe, tradução não).
  for (const loc of LOCALES) {
    const empties = Object.entries(maps[loc])
      .filter(([, v]) => typeof v === "string" && v.trim() === "")
      .map(([k]) => k)
      .sort();
    if (empties.length) {
      problems += empties.length;
      console.error(`\n✗ ${empties.length} valor(es) vazio(s) em ${loc}:`);
      for (const k of empties) console.error(`    ${k}`);
    }
  }

  if (problems) {
    console.error(`\n→ i18n com ${problems} problema(s). Corrija antes de commitar.`);
    process.exit(1);
  }
  console.log(`✓ i18n ok — ${baseKeys.size} chaves paritárias em ${LOCALES.join(", ")}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
