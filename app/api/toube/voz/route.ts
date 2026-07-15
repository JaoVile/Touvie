import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Voz do Toube via Piper (TTS neural LOCAL). Este handler roda o binário do piper
// no servidor Node e devolve o WAV pro cliente tocar. Só funciona onde o piper
// está instalado (a máquina local) — NÃO na Vercel. Caminhos via env, com default
// pro venv que o setup criou (~/.local/share/piper-tts/...).
export const runtime = "nodejs";

const HOME = process.env.HOME ?? "";
const PIPER_BIN = process.env.PIPER_BIN ?? `${HOME}/.local/share/piper-tts/venv/bin/piper`;
const PIPER_MODEL =
  process.env.PIPER_MODEL ?? `${HOME}/.local/share/piper-tts/voices/pt_BR-faber-medium.onnx`;

/** Gera o WAV chamando o piper (texto via stdin, saída num arquivo temporário). */
function synth(text: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PIPER_BIN, ["-m", PIPER_MODEL, "-f", outPath]);
    proc.on("error", reject); // piper ausente / caminho errado
    proc.stderr.on("data", () => {}); // piper loga progresso no stderr — ignora
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`piper saiu com código ${code}`)),
    );
    proc.stdin.write(text);
    proc.stdin.end();
  });
}

export async function POST(req: Request) {
  let text = "";
  try {
    text = String(((await req.json()) as { text?: unknown }).text ?? "");
  } catch {
    return new Response("json inválido", { status: 400 });
  }
  text = text.trim().slice(0, 2000); // teto pra não gerar áudios gigantes
  if (!text) return new Response("texto vazio", { status: 400 });

  const out = join(tmpdir(), `toube-voz-${randomUUID()}.wav`);
  try {
    await synth(text, out);
    const buf = await readFile(out);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch {
    // piper não instalado / falhou — o cliente trata como "voz indisponível".
    return new Response("falha na síntese de voz", { status: 503 });
  } finally {
    unlink(out).catch(() => {});
  }
}
