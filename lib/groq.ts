// Cliente fino do Groq (OpenAI-compatível), free tier. Usado pelo Toube Planos
// (llama-3.3, plano estruturado) e pela transcrição de áudio (Whisper). A key vive
// só no servidor. (Visão/OCR usa o Gemini free tier em lib/gemini-vision.ts — o
// modelo de visão do Groq foi desativado da conta.)
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
export const GROQ_MODEL = "llama-3.3-70b-versatile";
const WHISPER_MODEL = "whisper-large-v3-turbo";

export type GroqResponse = {
  choices?: {
    message?: {
      content?: string;
      tool_calls?: { function?: { name?: string; arguments?: string } }[];
    };
  }[];
};

// Fetch com retry pros transitórios do Groq (429 rate limit / 5xx). Erro
// permanente (400/401) não repete. A FormData/JSON é reusável entre tentativas.
async function groqFetchRetry(url: string, init: RequestInit, label: string): Promise<Response> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    lastStatus = res.status;
    if (res.status === 429 || res.status >= 500) continue; // transitório → tenta de novo
    const detail = await res.text().catch(() => "");
    throw new Error(`${label} ${res.status}: ${detail.slice(0, 200)}`);
  }
  throw new Error(`${label} ${lastStatus}: sem sucesso após 3 tentativas`);
}

/** Transcreve um áudio (webm/opus, mp4/aac, mp3…) em PT-BR via Whisper. */
export async function groqTranscribe(file: Blob, filename: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY não configurada");
  const fd = new FormData();
  fd.set("file", file, filename);
  fd.set("model", WHISPER_MODEL);
  fd.set("language", "pt");
  const res = await groqFetchRetry(
    GROQ_TRANSCRIBE_URL,
    { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd },
    "Groq transcribe",
  );
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

export async function groqChat(body: Record<string, unknown>): Promise<GroqResponse> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY não configurada");
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: GROQ_MODEL, ...body }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as GroqResponse;
}
