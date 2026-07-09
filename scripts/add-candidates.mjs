// Adiciona candidatos ESCOLHIDOS (por agentes/humano) ao staging de uma textura,
// a partir de um JSON no stdin. Baixa o preview, deduplica (por md5, contra os
// arquivos de produção e o staging já existente), mescla no candidates.json e
// regenera a audition.html. Complementa o fetch-candidates (que busca por query);
// aqui a seleção já veio pronta (ex.: triada por agentes via search-freesound).
//
// Uso:
//   cat escolhas.json | node scripts/add-candidates.mjs violinos
//
// Formato do JSON (array): [{ id, name, author, license, duration, preview }]
//   - `license` pode ser URL do Freesound ou label ("CC0"/"CC BY 4.0")
//   - `preview` é a URL do preview-hq-mp3

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auditionHtml } from "./fetch-candidates.mjs";
import { LICENSE_LABEL, OUT_DIR, download, loadManifest } from "./fetch-sounds.mjs";

const md5 = (b) => createHash("md5").update(b).digest("hex");

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const key = process.argv[2];
  if (!key) {
    console.error("Uso: cat escolhas.json | node scripts/add-candidates.mjs <key>");
    process.exit(1);
  }
  let picks;
  try {
    picks = JSON.parse(await readStdin());
    if (!Array.isArray(picks)) throw new Error("não é array");
  } catch (e) {
    console.error(`✗ JSON inválido no stdin: ${e.message}`);
    process.exit(1);
  }

  const stageDir = path.join(OUT_DIR, "_staging", key);
  if (!existsSync(stageDir)) await mkdir(stageDir, { recursive: true });

  const manifest = await loadManifest();
  const appliedIds = new Set(manifest.filter((c) => c.key === key).map((c) => c.freesoundId));

  let staged = [];
  try {
    staged = JSON.parse(await readFile(path.join(stageDir, "candidates.json"), "utf8")).candidates;
  } catch {
    /* primeira rodada */
  }
  const haveIds = new Set([...appliedIds, ...staged.map((c) => c.freesoundId)]);

  // md5 dos arquivos de produção + staging, pra não reoferecer conteúdo repetido.
  const skipHashes = new Set();
  const re = new RegExp(`^${key}(-\\d+)?\\.mp3$`);
  for (const f of (await readdir(OUT_DIR)).filter((f) => re.test(f))) {
    skipHashes.add(md5(await readFile(path.join(OUT_DIR, f))));
  }
  for (const c of staged) if (c.md5) skipHashes.add(c.md5);

  let added = 0;
  for (const p of picks) {
    const id = p.id ?? p.freesoundId;
    if (!id || haveIds.has(id) || !p.preview) continue;
    haveIds.add(id);
    const dest = path.join(stageDir, `cand-${id}.mp3`);
    try {
      await download(p.preview, dest);
      const hash = md5(await readFile(dest));
      if (skipHashes.has(hash)) {
        console.log(`  ~ pulei #${id} (conteúdo repetido)`);
        continue;
      }
      skipHashes.add(hash);
      staged.push({
        freesoundId: id,
        title: p.name ?? p.title ?? `#${id}`,
        author: p.author ?? "?",
        license: LICENSE_LABEL[p.license] ?? p.license ?? "?",
        source: p.url ?? `https://freesound.org/s/${id}/`,
        duration: p.duration,
        score: p.score ?? null,
        md5: hash,
      });
      added++;
      console.log(`✓ #${id} "${(p.name ?? "").slice(0, 44)}" (${p.duration ?? "?"}s)`);
    } catch (e) {
      console.error(`✗ #${id}: ${e.message}`);
    }
  }

  const pending = staged.filter((c) => !appliedIds.has(c.freesoundId));
  await writeFile(
    path.join(stageDir, "candidates.json"),
    `${JSON.stringify({ key, candidates: staged }, null, 2)}\n`,
  );
  await writeFile(path.join(stageDir, "audition.html"), auditionHtml(key, pending));
  console.log(
    `\n→ +${added} adicionados (pool: ${staged.length}, pendentes: ${pending.length})` +
      `\n→ ouça em http://127.0.0.1:4444/${key}/audition.html`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
