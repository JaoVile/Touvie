// Verifica se os créditos do manifest realmente batem com os arquivos em disco:
// pra cada som creditado, re-baixa o preview do Freesound (mesmo endpoint que o
// fetch usa) e compara o md5 com o `<key>-<n>.mp3` local. Pega o caso em que o
// áudio foi trocado mas o crédito ficou pra trás (ex.: piano-3 dessincronizado).
//
// Uso:
//   node scripts/verify-credits.mjs            # todos os créditos
//   node scripts/verify-credits.mjs violao     # só uma textura
//
// Só cobre o que TEM crédito (freesoundId). Órfãos aparecem à parte.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { OUT_DIR, getKey } from "./fetch-sounds.mjs";

const API = "https://freesound.org/apiv2";
const md5 = (b) => createHash("md5").update(b).digest("hex");

async function fetchT(url, opts = {}, ms = 20_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const only = process.argv[2];
  const token = await getKey();
  if (!token) {
    console.error("✗ Falta FREESOUND_API_KEY (.env.local).");
    process.exit(1);
  }
  const manifest = JSON.parse(await readFile(path.join(OUT_DIR, "manifest.json"), "utf8"));
  const sounds = (manifest.sounds ?? []).filter((s) => !only || s.key === only);

  let ok = 0;
  let bad = 0;
  for (const s of sounds) {
    const id = s.variant ? `${s.key}-${s.variant}` : s.key;
    if (!s.freesoundId) {
      console.log(`○ ${id.padEnd(12)} sem freesoundId (órfão)`);
      continue;
    }
    let local;
    try {
      local = md5(await readFile(path.join(OUT_DIR, `${id}.mp3`)));
    } catch {
      console.log(`✗ ${id.padEnd(12)} arquivo local ausente`);
      bad++;
      continue;
    }
    try {
      const info = await fetchT(
        `${API}/sounds/${s.freesoundId}/?fields=previews`,
        { headers: { Authorization: `Token ${token}` } },
        20_000,
      );
      if (!info.ok) {
        console.log(`? ${id.padEnd(12)} API ${info.status} (#${s.freesoundId})`);
        continue;
      }
      const url = (await info.json()).previews?.["preview-hq-mp3"];
      const buf = Buffer.from(await (await fetchT(url, {}, 30_000)).arrayBuffer());
      const match = local === md5(buf);
      console.log(
        `${match ? "✅" : "❌"} ${id.padEnd(12)} #${String(s.freesoundId).padEnd(7)} ${
          match ? "confere" : "DESSINCRONIZADO"
        }  ${s.author} — ${s.title.slice(0, 34)}`,
      );
      match ? ok++ : bad++;
    } catch (e) {
      console.log(`? ${id.padEnd(12)} erro rede: ${e.message}`);
    }
  }
  console.log(`\n→ ${ok} conferem, ${bad} problema(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
