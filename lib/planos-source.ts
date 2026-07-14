// Ingestão de fonte pro Toube Planos: extrai texto de um link comum, de um
// vídeo do YouTube (via transcript/legenda) ou de um PDF (buffer), pra servir
// de base pro modelo montar o plano. Toda falha vira Error com mensagem
// amigável em PT-BR (a rota transforma isso em 422).

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { extractText, getDocumentProxy } from "unpdf";
import { YoutubeTranscript } from "youtube-transcript";

const YT = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/;

/** IP em faixa privada/loopback/link-local/metadata (v4 e v6, incl. IPv4-mapeado). */
function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 127 ||
      a === 10 ||
      (a === 169 && b === 254) ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (v === 6) {
    const lo = ip.toLowerCase();
    if (lo === "::1" || lo === "::") return true;
    const mapped = lo.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return /^f[cd]/.test(lo) || /^fe[89ab]/.test(lo); // ULA fc00::/7 + link-local fe80::/10
  }
  return false;
}

// Barra SSRF: só http(s), e RESOLVE o IP real do host pra barrar loopback/rede
// interna/metadata mesmo via DNS apontando pra IP privado (rebind simples).
// (Nota: não fixa o IP resolvido na conexão, então rebind multi-IP/round-robin
// TOCTOU não é 100% coberto — aceitável pra app single-user autenticado.)
async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Link inválido.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Só consigo abrir links http(s).");
  }
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Não consigo abrir esse endereço.");
  }
  let ip: string;
  try {
    ip = isIP(host) ? host : (await lookup(host)).address;
  } catch {
    throw new Error("Não consegui resolver esse endereço.");
  }
  if (isPrivateIp(ip)) throw new Error("Não consigo abrir esse endereço.");
  return u;
}

/** Fetch que revalida cada redirect contra o guard (não segue pra rede interna). */
async function safeFetch(raw: string): Promise<Response> {
  let current = raw;
  for (let hop = 0; hop < 4; hop++) {
    const u = await assertPublicUrl(current);
    let res: Response;
    try {
      res = await fetch(u, {
        headers: { "user-agent": "Mozilla/5.0 Touvie" },
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new Error("Não consegui abrir esse link.");
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      current = new URL(loc, u).href; // resolve relativo, revalida no próximo hop
      continue;
    }
    return res;
  }
  throw new Error("Esse link tem redirecionamentos demais.");
}

export async function extractFromUrl(
  url: string,
): Promise<{ kind: "youtube" | "link"; text: string }> {
  const yt = url.match(YT);
  if (yt) {
    try {
      const parts = await YoutubeTranscript.fetchTranscript(url);
      const text = parts
        .map((p) => p.text)
        .join(" ")
        .trim();
      if (!text) throw new Error("empty");
      return { kind: "youtube", text };
    } catch {
      throw new Error(
        "Esse vídeo não tem legenda/transcript disponível. Me descreve o treino que eu monto.",
      );
    }
  }
  // Link comum: fetch com guard SSRF (DNS + redirect) + tira tags, colapsa espaço.
  const res = await safeFetch(url);
  if (!res.ok) throw new Error("Não consegui abrir esse link.");
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) throw new Error("Não achei texto útil nesse link.");
  return { kind: "link", text };
}

export async function extractFromPdf(buf: ArrayBuffer): Promise<{ kind: "pdf"; text: string }> {
  let clean: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    clean = (Array.isArray(text) ? text.join(" ") : text).replace(/\s+/g, " ").trim();
  } catch {
    throw new Error("Não consegui ler esse PDF.");
  }
  if (!clean) throw new Error("Esse PDF não tem texto extraível (talvez seja escaneado).");
  return { kind: "pdf", text: clean };
}
