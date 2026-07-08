// Aplica candidatos de audição aos slots finais de uma textura: copia o mp3 de
// staging pra `public/sounds/<key>-<slot>.mp3` E grava/atualiza o crédito no
// manifest.json com a procedência real (Freesound ID/autor/licença/fonte).
// Assim todo arquivo em produção fica com atribuição CC-BY correta.
//
// Uso:
//   node scripts/apply-candidates.mjs piano 3=532774 5=761374
//     → piano-3.mp3 ← cand-532774, piano-5.mp3 ← cand-761374, credita ambos.
//
// Rode fetch-candidates.mjs antes (precisa de _staging/<key>/candidates.json).

import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { MANIFEST, OUT_DIR, TARGETS } from "./fetch-sounds.mjs";

async function main() {
  const [key, ...pairs] = process.argv.slice(2);
  if (!TARGETS.some((t) => t.key === key) || pairs.length === 0) {
    console.error("Uso: node scripts/apply-candidates.mjs <key> <slot>=<freesoundId> ...");
    process.exit(1);
  }

  const stageDir = path.join(OUT_DIR, "_staging", key);
  const { candidates } = JSON.parse(await readFile(path.join(stageDir, "candidates.json"), "utf8"));
  const byId = new Map(candidates.map((c) => [String(c.freesoundId), c]));

  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  const sounds = manifest.sounds ?? [];

  for (const pair of pairs) {
    const [slotRaw, idRaw] = pair.split("=");
    const slot = Number.parseInt(slotRaw, 10);
    const cand = byId.get(idRaw);
    if (!cand || !Number.isInteger(slot) || slot < 1) {
      console.error(`✗ par inválido "${pair}" (id não está no candidates.json?)`);
      process.exit(1);
    }
    const file = `/sounds/${key}-${slot}.mp3`;
    await copyFile(
      path.join(stageDir, `cand-${cand.freesoundId}.mp3`),
      path.join(OUT_DIR, `${key}-${slot}.mp3`),
    );
    // remove crédito antigo desse slot e reinsere o novo
    const idx = sounds.findIndex((s) => s.key === key && (s.variant ?? 1) === slot);
    const credit = {
      key,
      variant: slot,
      file,
      title: cand.title,
      author: cand.author,
      license: cand.license,
      source: cand.source,
      freesoundId: cand.freesoundId,
    };
    if (idx >= 0) sounds[idx] = credit;
    else sounds.push(credit);
    console.log(`✓ ${key}-${slot} ← #${cand.freesoundId} "${cand.title}" (${cand.license})`);
  }

  // reordena: por key na ordem canônica, depois por variant
  const order = TARGETS.map((t) => t.key);
  sounds.sort(
    (a, b) => order.indexOf(a.key) - order.indexOf(b.key) || (a.variant ?? 1) - (b.variant ?? 1),
  );
  manifest.sounds = sounds;
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\n→ manifest.json atualizado (${sounds.length} sons).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
