// Monta uma página de audição dos takes ATUAIS de uma textura (os que já estão
// no app), pra você reouvir e decidir quais manter/trocar antes de curar. Copia
// os `<key>-N.mp3` de produção pra `_staging/<key>-atual/` e gera audition.html
// com crédito (ou marca "órfão" quando falta fonte no manifest) + duração.
//
// Uso:
//   node scripts/stage-current.mjs violinos
//
// Serve junto do servidor estático de staging: /<key>-atual/audition.html

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { OUT_DIR, TARGETS } from "./fetch-sounds.mjs";

// Parser de duração MP3 sem dependência (Xing/VBR + fallback CBR).
const BR = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
};
const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
function durationOf(buf) {
  let i = 0;
  if (buf.slice(0, 3).toString("latin1") === "ID3") {
    const sz =
      ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    i = 10 + sz;
  }
  while (i < buf.length - 4 && !(buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0)) i++;
  const vb = (buf[i + 1] >> 3) & 3;
  const v = vb === 3 ? 1 : 2;
  const bitrate = BR[v][(buf[i + 2] >> 4) & 0xf] * 1000;
  const sr = SR[vb][(buf[i + 2] >> 2) & 3];
  const spf = vb === 3 ? 1152 : 576;
  const xo = i + (vb === 3 ? 36 : 21);
  const tag = buf.slice(xo, xo + 4).toString("latin1");
  if ((tag === "Xing" || tag === "Info") && buf.readUInt32BE(xo + 4) & 1) {
    return (buf.readUInt32BE(xo + 8) * spf) / sr;
  }
  return ((buf.length - i) * 8) / bitrate;
}

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

async function main() {
  const key = process.argv[2];
  const target = TARGETS.find((t) => t.key === key);
  if (!target) {
    console.error(`Use uma key conhecida: ${TARGETS.map((t) => t.key).join(", ")}`);
    process.exit(1);
  }
  const count = Math.max(1, target.variants ?? 1);
  const outDir = path.join(OUT_DIR, "_staging", `${key}-atual`);
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

  const manifest = JSON.parse(await readFile(path.join(OUT_DIR, "manifest.json"), "utf8"));
  const credit = new Map(
    manifest.sounds.filter((s) => s.key === key).map((s) => [s.variant ?? 1, s]),
  );

  let total = 0;
  const rows = [];
  for (let n = 1; n <= count; n++) {
    const src = path.join(OUT_DIR, count > 1 ? `${key}-${n}.mp3` : `${key}.mp3`);
    const buf = await readFile(src);
    await copyFile(src, path.join(outDir, `${key}-${n}.mp3`));
    const d = durationOf(buf);
    total += d;
    const c = credit.get(n);
    const md5 = createHash("md5").update(buf).digest("hex").slice(0, 8);
    const tag = c
      ? `<span class="ok">✅ ${esc(c.license)}</span> <span class="by">${esc(c.author)}</span> <span class="ti">${esc(c.title)}</span>`
      : `<span class="orphan">⚠️ ÓRFÃO (sem crédito)</span>`;
    rows.push(
      `<li><div class="meta"><strong>${key}-${n}</strong> <span class="dur">${d.toFixed(0)}s</span> ${tag} <span class="md5">${md5}</span></div>` +
        `<audio controls preload="none" src="./${key}-${n}.mp3"></audio></li>`,
    );
  }

  const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${key} — takes atuais</title>
<style>body{font:15px/1.5 system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;color:#111;background:#faf9f7}
@media(prefers-color-scheme:dark){body{color:#eee;background:#151515}}
h1{font-size:1.3rem}ul{list-style:none;padding:0}li{border:1px solid #8883;border-radius:10px;padding:.7rem 1rem;margin:.6rem 0}
.meta{margin-bottom:.4rem}.dur{font-size:.75rem;background:#8882;border-radius:99px;padding:.1rem .5rem;margin:0 .3rem}
.ok{color:#2a7}.orphan{color:#c62;font-weight:600}.by{color:#888}.ti{color:#999;font-size:.85rem}.md5{color:#aaa;font-size:.7rem}audio{width:100%}</style></head><body>
<h1>🎻 ${key} — ${count} takes atuais <small>(${(total / 60).toFixed(1)} min no total)</small></h1>
<p>Estes são os que já estão no app. Ouça e me diga quais manter/trocar.</p>
<ul>${rows.join("\n")}</ul></body></html>`;
  await writeFile(path.join(outDir, "audition.html"), html);
  console.log(
    `→ ${count} takes atuais em ${outDir} (${(total / 60).toFixed(1)} min)\n` +
      `→ ouça em http://127.0.0.1:4444/${key}-atual/audition.html`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
