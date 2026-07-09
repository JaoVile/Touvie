// Busca no Freesound e imprime METADADOS em JSON (sem baixar nada). Serve pra um
// agente/humano triar candidatos por julgamento (título, tags, duração, licença)
// antes de baixar. Não pontua nem filtra — devolve cru, dedupado por id.
//
// Uso:
//   node scripts/search-freesound.mjs "ambient violin pad" "cello drone calm"
//
// Saída: JSON array de { id, name, author, license, duration, tags, preview, url }
// (só itens COM preview-hq-mp3 — os que dá pra baixar depois).

import { getKey, search } from "./fetch-sounds.mjs";

async function main() {
  const queries = process.argv.slice(2);
  if (queries.length === 0) {
    console.error('Uso: node scripts/search-freesound.mjs "query 1" "query 2" ...');
    process.exit(1);
  }
  const token = await getKey();
  if (!token) {
    console.error("✗ Falta FREESOUND_API_KEY (.env.local).");
    process.exit(1);
  }

  const seen = new Map();
  for (const q of queries) {
    try {
      for (const r of await search(q, token)) {
        if (!r?.previews?.["preview-hq-mp3"] || seen.has(r.id)) continue;
        seen.set(r.id, {
          id: r.id,
          name: r.name,
          author: r.username,
          license: r.license,
          duration: Math.round(r.duration ?? 0),
          tags: (r.tags ?? []).slice(0, 12),
          preview: r.previews["preview-hq-mp3"],
          url: r.url,
        });
      }
    } catch (e) {
      console.error(`  (aviso "${q}": ${e.message})`);
    }
  }
  process.stdout.write(`${JSON.stringify([...seen.values()], null, 2)}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
