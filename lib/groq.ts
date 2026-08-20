// Cliente fino do Groq (OpenAI-compatível), free tier. Usado pelo Toube Planos
// (plano estruturado, com tool calling) e pela transcrição de áudio (Whisper). A key
// vive só no servidor. (Visão/OCR usa o Gemini free tier em lib/gemini-vision.ts — o
// modelo de visão do Groq foi desativado da conta.)
// ⚠️ O Groq APOSENTA modelo sem aviso: `llama-3.3-70b-versatile` saiu do catálogo e
// passou a devolver 404 `model_not_found`, o que matava o modo Plano em silêncio.
// Se o Plano parar de responder, confira `GET /openai/v1/models` ANTES de caçar bug.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
export const GROQ_MODEL = "openai/gpt-oss-120b";
const WHISPER_MODEL = "whisper-large-v3-turbo";

export type GroqResponse = {
  choices?: {
    message?: {
      content?: string;
      tool_calls?: { function?: { name?: string; arguments?: string } }[];
    };
  }[];
};

const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Espera antes da próxima tentativa: honra `Retry-After` (429, em segundos)
// capado em 5s; senão exponencial 300ms·2^attempt. `attempt` é 0-based
// (0 = após a 1ª falha → 300ms; 1 → 600ms).
function backoffMs(res: Response | null, attempt: number): number {
  const retryAfter = res?.headers.get("retry-after");
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs) && secs > 0) return Math.min(secs * 1000, 5000);
  }
  return 300 * 2 ** attempt;
}

// Fetch com retry + backoff pros transitórios do Groq (429 rate limit / 5xx). Erro
// permanente (400/401) não repete. A FormData/JSON é reusável entre tentativas.
async function groqFetchRetry(url: string, init: RequestInit, label: string): Promise<Response> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    lastStatus = res.status;
    if (res.status === 429 || res.status >= 500) {
      if (attempt < MAX_ATTEMPTS - 1) await sleep(backoffMs(res, attempt));
      continue; // transitório → tenta de novo
    }
    const detail = await res.text().catch(() => "");
    throw new Error(`${label} ${res.status}: ${detail.slice(0, 200)}`);
  }
  throw new Error(`${label} ${lastStatus}: sem sucesso após ${MAX_ATTEMPTS} tentativas`);
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

// Chat completion com retry + backoff. Além de 429/5xx, repete no `tool_use_failed`
// (HTTP 400 que o modelo às vezes emite com tool-call malformado — transitório).
// Outros 400/401 são permanentes e estouram na hora. Todo caller (planos, compact,
// leitura/ask) herda essa resiliência.
export async function groqChat(body: Record<string, unknown>): Promise<GroqResponse> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY não configurada");
  const init: RequestInit = {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    // `reasoning_effort: "low"` corta o raciocínio longo do gpt-oss (que vem num campo
    // `reasoning` separado e só gasta tempo/token aqui). Caller pode sobrescrever.
    body: JSON.stringify({ model: GROQ_MODEL, reasoning_effort: "low", ...body }),
  };
  let lastErr = "";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(GROQ_URL, init);
    if (res.ok) return (await res.json()) as GroqResponse;
    const detail = await res.text().catch(() => "");
    lastErr = `Groq ${res.status}: ${detail.slice(0, 200)}`;
    const retriable = res.status === 429 || res.status >= 500 || detail.includes("tool_use_failed");
    if (!retriable) throw new Error(lastErr);
    if (attempt < MAX_ATTEMPTS - 1) await sleep(backoffMs(res, attempt));
  }
  throw new Error(`${lastErr} (sem sucesso após ${MAX_ATTEMPTS} tentativas)`);
}
