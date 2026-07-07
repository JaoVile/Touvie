// Busca e baixa loops ambientes/instrumentais do Freesound (CC0 + CC-BY) pras
// texturas do som de fundo, e gera/atualiza public/sounds/manifest.json (créditos).
//
// Uso:
//   FREESOUND_API_KEY=xxx node scripts/fetch-sounds.mjs            # todas
//   node scripts/fetch-sounds.mjs mar piano violao                 # só essas
//   (lê a chave de .env.local automaticamente)
//
// Só usa busca + PREVIEWS hq-mp3 (públicos, sem OAuth). Filtra licenças
// comerciais-OK (CC0 + Attribution). A seleção pontua por relevância: casa
// palavra-chave no NOME/TAGS e penaliza termos indesejados — pra não pegar
// "popular porém errado".

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public", "sounds");
const MANIFEST = path.join(OUT_DIR, "manifest.json");

async function getKey() {
  if (process.env.FREESOUND_API_KEY) return process.env.FREESOUND_API_KEY.trim();
  try {
    const env = await readFile(path.join(ROOT, ".env.local"), "utf8");
    const m = env.match(/^FREESOUND_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  } catch {
    /* sem .env.local */
  }
  return null;
}

// must: termos que DEVEM aparecer (nome vale +2, tag +1).
// avoid: termos que derrubam o candidato (-5).
const TARGETS = [
  {
    key: "chuva",
    variants: 3,
    queries: [
      "gentle rain loop",
      "rain ambience",
      "soft rain loop",
      "light rain steady",
      "rain on window calm",
    ],
    must: ["rain"],
    avoid: ["thunder", "storm", "city"],
  },
  {
    key: "mar",
    variants: 3,
    queries: ["ocean waves loop", "sea waves beach", "calm waves shore"],
    must: ["wave", "ocean", "sea", "surf"],
    avoid: ["underwater", "submarine", "boat", "engine"],
  },
  {
    key: "ruido-rosa",
    queries: ["pink noise", "pink noise loop"],
    must: ["pink", "noise"],
    avoid: ["city", "crowd", "music", "guitar"],
  },
  {
    key: "ruido-marrom",
    queries: ["brown noise", "brownian noise loop", "brown noise sleep"],
    must: ["brown", "noise"],
    avoid: ["bucket", "fx", "city", "music"],
  },
  {
    key: "floresta",
    variants: 3,
    queries: [
      "forest birds ambience",
      "woodland birds morning",
      "forest ambience calm",
      "spring birds nature",
      "jungle birds gentle",
    ],
    must: ["forest", "bird", "wood"],
    avoid: ["traffic", "city", "horror"],
  },
  {
    key: "vento",
    variants: 3,
    queries: [
      "wind ambience loop",
      "soft wind plain",
      "gentle wind loop",
      "breeze ambience calm",
      "wind through trees soft",
    ],
    must: ["wind"],
    avoid: ["storm", "howling", "horror"],
  },
  {
    key: "violinos",
    variants: 3,
    queries: [
      "strings ambient pad",
      "string ensemble loop",
      "cinematic strings soft",
      "warm strings loop",
      "legato strings calm",
    ],
    must: ["string", "violin", "cello", "orchestra"],
    avoid: ["guitar", "ominous", "horror", "dark", "scary"],
  },
  {
    key: "violao",
    variants: 5,
    queries: [
      "lofi acoustic guitar loop",
      "sad acoustic guitar loop",
      "melancholy guitar ambient",
      "nostalgic guitar calm",
      "emotional acoustic guitar",
    ],
    must: ["guitar", "acoustic"],
    avoid: ["ominous", "horror", "dark", "scary", "distortion", "metal", "electric", "strumming", "strum", "fast", "bpm", "upbeat", "piano"],
  },
  {
    key: "piano",
    variants: 3,
    queries: [
      "calm piano loop",
      "felt piano ambient",
      "soft piano melody loop",
      "ambient piano gentle",
      "slow piano loop",
    ],
    must: ["piano"],
    avoid: ["guitar", "horror", "dark", "scary"],
  },
];

const LICENSE_LABEL = {
  "http://creativecommons.org/publicdomain/zero/1.0/": "CC0",
  "https://creativecommons.org/publicdomain/zero/1.0/": "CC0",
  "http://creativecommons.org/licenses/by/4.0/": "CC BY 4.0",
  "https://creativecommons.org/licenses/by/4.0/": "CC BY 4.0",
  "http://creativecommons.org/licenses/by/3.0/": "CC BY 3.0",
  "https://creativecommons.org/licenses/by/3.0/": "CC BY 3.0",
};

const API = "https://freesound.org/apiv2";

// fetch com timeout (o Freesound às vezes pendura a conexão — sem isto o script
// trava indefinidamente num único download/busca).
async function fetchT(url, opts = {}, ms = 20_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function search(query, token) {
  // Sem sort forçado → relevância padrão do Freesound. Inclui tags pra pontuar.
  const filter = 'duration:[15 TO 240] license:("Creative Commons 0" OR "Attribution")';
  const url = `${API}/search/text/?query=${encodeURIComponent(query)}&filter=${encodeURIComponent(
    filter,
  )}&fields=${encodeURIComponent(
    "id,name,username,license,previews,duration,url,tags",
  )}&page_size=15`;
  const res = await fetchT(url, { headers: { Authorization: `Token ${token}` } });
  if (!res.ok) throw new Error(`Freesound ${res.status}: ${await res.text()}`);
  return (await res.json()).results ?? [];
}

function score(result, target) {
  if (!result?.previews?.["preview-hq-mp3"]) return Number.NEGATIVE_INFINITY;
  const name = (result.name ?? "").toLowerCase();
  const tags = (result.tags ?? []).map((t) => t.toLowerCase());
  let s = 0;
  for (const m of target.must) {
    if (name.includes(m)) s += 2;
    if (tags.includes(m)) s += 1;
  }
  for (const a of target.avoid) {
    if (name.includes(a) || tags.includes(a)) s -= 5;
  }
  if (LICENSE_LABEL[result.license]) s += 1; // leve preferência pra licença mapeada
  return s;
}

async function download(urlStr, dest) {
  const res = await fetchT(urlStr, {}, 30_000);
  if (!res.ok) throw new Error(`download ${res.status} ${urlStr}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

async function loadManifest() {
  try {
    const raw = await readFile(MANIFEST, "utf8");
    return JSON.parse(raw).sounds ?? [];
  } catch {
    return [];
  }
}

async function main() {
  const token = await getKey();
  if (!token) {
    console.error(
      "✗ Falta FREESOUND_API_KEY (.env.local). Crie em https://freesound.org/apiv2/apply/",
    );
    process.exit(1);
  }
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  const only = process.argv.slice(2);
  const targets = only.length ? TARGETS.filter((t) => only.includes(t.key)) : TARGETS;
  if (only.length && targets.length === 0) {
    console.error(`✗ Chaves desconhecidas: ${only.join(", ")}`);
    process.exit(1);
  }

  // Mantém créditos existentes; só substitui os que re-baixarmos agora.
  const credits = (await loadManifest()).filter((c) => !targets.some((t) => t.key === c.key));

  for (const target of targets) {
    const seen = new Map(); // id -> result, dedup entre queries
    for (const q of target.queries) {
      try {
        for (const r of await search(q, token)) seen.set(r.id, r);
      } catch (e) {
        console.warn(`  aviso (${target.key} / "${q}"): ${e.message}`);
      }
    }
    const ranked = [...seen.values()]
      .map((r) => ({ r, s: score(r, target) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);

    if (ranked.length === 0) {
      console.error(`✗ ${target.key}: nada com relevância boa.`);
      continue;
    }

    const want = Math.max(1, target.variants ?? 1);
    const chosen = ranked.slice(0, want);
    if (chosen.length < want) {
      console.warn(`  aviso (${target.key}): só achei ${chosen.length}/${want} variações boas.`);
    }

    for (let i = 0; i < chosen.length; i++) {
      const { r: picked, s } = chosen[i];
      // 1 variação → "<key>.mp3"; várias → "<key>-1.mp3", "<key>-2.mp3", …
      const id = want > 1 ? `${target.key}-${i + 1}` : target.key;
      const dest = path.join(OUT_DIR, `${id}.mp3`);
      try {
        const bytes = await download(picked.previews["preview-hq-mp3"], dest);
        credits.push({
          key: target.key,
          variant: want > 1 ? i + 1 : undefined,
          file: `/sounds/${id}.mp3`,
          title: picked.name,
          author: picked.username,
          license: LICENSE_LABEL[picked.license] ?? picked.license,
          source: picked.url,
          freesoundId: picked.id,
        });
        console.log(
          `✓ ${id.padEnd(13)} [score ${s}] "${picked.name}" — ${picked.username} ` +
            `(${LICENSE_LABEL[picked.license] ?? "?"}, ${(bytes / 1024).toFixed(0)}kB)`,
        );
      } catch (e) {
        console.error(`✗ ${id}: ${e.message}`);
      }
    }
  }

  // Reordena os créditos na ordem canônica das texturas.
  const order = TARGETS.map((t) => t.key);
  credits.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const manifest = {
    generatedFrom: "freesound.org",
    note: "Áudios baixados via API do Freesound (previews HQ). Licenças CC0/CC-BY.",
    sounds: credits,
  };
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\n→ manifest.json com ${credits.length} sons.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
