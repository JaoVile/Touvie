// Ingestão de fonte pro Toube Planos: extrai texto de um link comum, de um
// vídeo do YouTube (via transcript/legenda) ou de um PDF (buffer), pra servir
// de base pro modelo montar o plano. Toda falha vira Error com mensagem
// amigável em PT-BR (a rota transforma isso em 422).

import { extractText, getDocumentProxy } from "unpdf";
import { YoutubeTranscript } from "youtube-transcript";

const YT = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/;

// Barra SSRF básico: só http(s) e nada de host privado/loopback/metadata.
function assertPublicHttpUrl(raw: string): URL {
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
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (blocked) throw new Error("Não consigo abrir esse endereço.");
  return u;
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
  // Link comum: fetch + tira tags/scripts, colapsa espaço.
  const safeUrl = assertPublicHttpUrl(url);
  let res: Response;
  try {
    res = await fetch(safeUrl, {
      headers: { "user-agent": "Mozilla/5.0 Touvie" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new Error("Não consegui abrir esse link.");
  }
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
