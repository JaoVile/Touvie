import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Voz do Toube — vozes neurais do Edge (Microsoft) via edge-tts: qualidade de
// estúdio, grátis, sem chave. PRECISA de internet (o cérebro do Toube também
// precisa, então na prática não muda nada) e o binário vem do venv local
// (~/.local/share/piper-tts) — NÃO roda na Vercel.
//
// Histórico: já houve motores locais aqui (Piper spawn + Kokoro via daemon,
// script guardado em ~/.local/share/piper-tts/kokoro-server.py) — removidos
// quando o usuário fechou a voz única. Voltam quando "Minha voz" (clone/treino
// próprio) entrar no provador.
export const runtime = "nodejs";

const HOME = process.env.HOME ?? "";
const EDGE_TTS_BIN = process.env.EDGE_TTS_BIN ?? `${HOME}/.local/share/piper-tts/venv/bin/edge-tts`;

// Whitelist (o provador em /config lista as mesmas) — nunca montar parâmetro
// com input cru do cliente. pitch/rate = ajuste fino de prosódia.
type VoiceSpec = { voice: string; pitch?: string; rate?: string };
const VOICES: Record<string, VoiceSpec> = {
  // A VOZ DO TOUBE: Hyunsu (multilíngue pt+en) afinado em +8Hz — masculina,
  // jovem, suave; escolhida no provador em 17/jul. Identidade exibida: "Toube".
  hyunsu8: { voice: "ko-KR-HyunsuMultilingualNeural", pitch: "+8Hz" },
};

/** Sintetiza no edge-tts (MP3 num arquivo temporário). */
async function edgeSynth(text: string, spec: VoiceSpec): Promise<ArrayBuffer | null> {
  const out = join(tmpdir(), `toube-voz-${randomUUID()}.mp3`);
  try {
    await new Promise<void>((resolve, reject) => {
      const args = ["--voice", spec.voice, "--text", text, "--write-media", out];
      if (spec.pitch) args.push(`--pitch=${spec.pitch}`);
      if (spec.rate) args.push(`--rate=${spec.rate}`);
      const proc = spawn(EDGE_TTS_BIN, args);
      proc.on("error", reject);
      proc.stderr.on("data", () => {});
      proc.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(`edge-tts saiu com código ${code}`)),
      );
    });
    const buf = await readFile(out);
    // Cópia pra ArrayBuffer "puro" — o BodyInit do TS não aceita o Uint8Array
    // genérico (ArrayBufferLike) que o readFile devolve.
    const ab = new ArrayBuffer(buf.byteLength);
    new Uint8Array(ab).set(buf);
    return ab;
  } catch {
    return null; // sem internet / endpoint mudou — o cliente silencia (503)
  } finally {
    unlink(out).catch(() => {});
  }
}

export async function POST(req: Request) {
  let text = "";
  let voice = "";
  try {
    const body = (await req.json()) as { text?: unknown; voice?: unknown };
    text = String(body.text ?? "");
    voice = String(body.voice ?? "");
  } catch {
    return new Response("json inválido", { status: 400 });
  }
  text = text.trim().slice(0, 2000); // teto pra não gerar áudios gigantes
  if (!text) return new Response("texto vazio", { status: 400 });
  const spec = VOICES[voice] ?? VOICES.hyunsu8; // fallback = a voz oficial

  const audio = await edgeSynth(text, spec);
  if (!audio) return new Response("falha na síntese de voz", { status: 503 });

  return new Response(audio, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
