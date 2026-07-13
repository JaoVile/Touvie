// Ingestão de fonte pro Toube Planos: extrai texto de um link comum, de um
// vídeo do YouTube (via transcript/legenda) ou de um PDF (buffer), pra servir
// de base pro modelo montar o plano. Toda falha vira Error com mensagem
// amigável em PT-BR (a rota transforma isso em 422).

import { extractText, getDocumentProxy } from "unpdf";
import { YoutubeTranscript } from "youtube-transcript";

const YT = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/;

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
  let res: Response;
  try {
    res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 Touvie" } });
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
