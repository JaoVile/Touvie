// Curadoria humana dos loops instrumentais: baixa um POOL de candidatos de uma
// textura pra uma pasta de staging, com metadados + player, pra você OUVIR e
// escolher os bons. Diferente do fetch-sounds.mjs (que auto-escolhe e sobrescreve
// os arquivos finais), aqui nada toca os `<key>-N.mp3` de produção — só popula
// `public/sounds/_staging/<key>/` e gera uma página de audição.
//
// Uso:
//   node scripts/fetch-candidates.mjs piano 8      # 8 candidatos de piano
//   node scripts/fetch-candidates.mjs violinos 10
//
// Depois de ouvir em /sounds/_staging/<key>/audition.html, aplique os escolhidos
// com scripts/apply-candidates.mjs (grava arquivo final + crédito no manifest).
//
// Dedupe: pula candidatos cujo Freesound ID já está no manifest E candidatos
// cujo CONTEÚDO (md5) bate com algum `<key>-N.mp3` já existente — pra não
// reoferecer o que você já tem.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  LICENSE_LABEL,
  OUT_DIR,
  TARGETS,
  download,
  getKey,
  loadManifest,
  score,
  search,
} from "./fetch-sounds.mjs";

const md5 = (buf) => createHash("md5").update(buf).digest("hex");

async function existingHashes(key) {
  // md5 de todos os `<key>-N.mp3` (e `<key>.mp3`) já em produção.
  const hashes = new Set();
  const files = await readdir(OUT_DIR);
  const re = new RegExp(`^${key}(-\\d+)?\\.mp3$`);
  for (const f of files.filter((f) => re.test(f))) {
    hashes.add(md5(await readFile(path.join(OUT_DIR, f))));
  }
  return hashes;
}

function auditionHtml(key, cands) {
  const rows = cands
    .map(
      (c) => `
    <li>
      <div class="meta">
        <strong>#${c.freesoundId}</strong> — ${escapeHtml(c.title)}
        <span class="by">por ${escapeHtml(c.author)}</span>
        <span class="lic">${c.license}</span>
        <span class="score">score ${c.score}</span>
        <span class="dur">${c.duration ? `${Math.round(c.duration)}s` : ""}</span>
      </div>
      <audio controls preload="none" src="./cand-${c.freesoundId}.mp3"></audio>
      <a href="${c.source}" target="_blank" rel="noopener">fonte no Freesound ↗</a>
      <div class="apply">aplicar: <code>node scripts/apply-candidates.mjs ${key} &lt;slot&gt;=${c.freesoundId}</code></div>
    </li>`,
    )
    .join("\n");
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Audição — ${key}</title>
<style>
  body{font:15px/1.5 system-ui,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;color:#111;background:#faf9f7}
  @media (prefers-color-scheme:dark){body{color:#eee;background:#151515}code{background:#333}a{color:#8bd}}
  h1{font-size:1.3rem}
  ul{list-style:none;padding:0}
  li{border:1px solid #8883;border-radius:10px;padding:.8rem 1rem;margin:.7rem 0}
  .meta{margin-bottom:.5rem}
  .by{color:#8a8a8a;margin-left:.4rem}
  .lic,.score,.dur{font-size:.75rem;background:#8882;border-radius:99px;padding:.1rem .5rem;margin-left:.4rem}
  audio{width:100%;margin:.3rem 0}
  code{background:#eee;padding:.1rem .3rem;border-radius:4px;font-size:.8rem}
  .apply{color:#8a8a8a;font-size:.8rem;margin-top:.3rem}
</style></head><body>
<h1>🎧 Audição — ${key} <small>(${cands.length} candidatos)</small></h1>
<p>Ouça cada um. Anote os <strong>#IDs</strong> que aprovar e me diga (ou rode o comando de aplicar com o slot de destino).</p>
<ul>${rows}</ul>
</body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

async function main() {
  const [key, countRaw] = process.argv.slice(2);
  const target = TARGETS.find((t) => t.key === key);
  if (!target) {
    console.error(`✗ Use uma key conhecida: ${TARGETS.map((t) => t.key).join(", ")}`);
    process.exit(1);
  }
  const count = Math.max(1, Number.parseInt(countRaw ?? "8", 10));
  const token = await getKey();
  if (!token) {
    console.error("✗ Falta FREESOUND_API_KEY (.env.local).");
    process.exit(1);
  }

  const stageDir = path.join(OUT_DIR, "_staging", key);
  if (!existsSync(stageDir)) await mkdir(stageDir, { recursive: true });

  const manifest = await loadManifest();
  const appliedIds = new Set(manifest.filter((c) => c.key === key).map((c) => c.freesoundId));

  // Candidatos já em staging de rodadas anteriores (não re-baixa, mas mantém no pool).
  let staged = [];
  try {
    staged = JSON.parse(await readFile(path.join(stageDir, "candidates.json"), "utf8")).candidates;
  } catch {
    /* primeira rodada */
  }

  // Não re-oferece nem o que já foi aplicado (manifest) nem o que já está em staging.
  const skipIds = new Set([...appliedIds, ...staged.map((c) => c.freesoundId)]);
  const skipHashes = await existingHashes(key);
  for (const c of staged) if (c.md5) skipHashes.add(c.md5);

  // Junta resultados de todas as queries do alvo, dedup por ID.
  const seen = new Map();
  for (const q of target.queries) {
    try {
      for (const r of await search(q, token)) seen.set(r.id, r);
    } catch (e) {
      console.warn(`  aviso ("${q}"): ${e.message}`);
    }
  }

  const ranked = [...seen.values()]
    .map((r) => ({ r, s: score(r, target) }))
    .filter((x) => x.s > 0 && !skipIds.has(x.r.id))
    .sort((a, b) => b.s - a.s);

  const cands = [];
  for (const { r, s } of ranked) {
    if (cands.length >= count) break;
    const dest = path.join(stageDir, `cand-${r.id}.mp3`);
    try {
      const url = r.previews?.["preview-hq-mp3"];
      if (!url) continue;
      await download(url, dest);
      const hash = md5(await readFile(dest));
      if (skipHashes.has(hash)) {
        console.log(`  ~ pulei #${r.id} (conteúdo idêntico a um já existente)`);
        continue;
      }
      skipHashes.add(hash); // dedup entre os próprios candidatos
      cands.push({
        freesoundId: r.id,
        title: r.name,
        author: r.username,
        license: LICENSE_LABEL[r.license] ?? r.license,
        source: r.url,
        duration: r.duration,
        score: s,
        md5: hash,
      });
      console.log(`✓ cand #${r.id} [score ${s}] "${r.name}" — ${r.username}`);
    } catch (e) {
      console.error(`✗ #${r.id}: ${e.message}`);
    }
  }

  // Merge com o staging anterior; a página de audição só mostra o que ainda NÃO
  // foi aplicado (freesoundId ausente do manifest).
  const pool = [...staged, ...cands];
  const pending = pool.filter((c) => !appliedIds.has(c.freesoundId));
  await writeFile(
    path.join(stageDir, "candidates.json"),
    `${JSON.stringify({ key, candidates: pool }, null, 2)}\n`,
  );
  await writeFile(path.join(stageDir, "audition.html"), auditionHtml(key, pending));
  console.log(
    `\n→ +${cands.length} novos (pool: ${pool.length}, pendentes de escolha: ${pending.length}) em ${stageDir}` +
      `\n→ ouça em http://127.0.0.1:4444/${key}/audition.html`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
