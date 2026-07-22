// Cliente fino do Groq (OpenAI-compatível), free tier. Usado pelo Toube Planos
// (llama-3.3, plano estruturado), pela transcrição de áudio (Whisper) e pela
// "visão" de anexos de imagem (Llama 4 Scout). A key vive só no servidor.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
export const GROQ_MODEL = "llama-3.3-70b-versatile";
const WHISPER_MODEL = "whisper-large-v3-turbo";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

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

/** Descreve uma imagem (data URL base64) em PT-BR via Llama 4 Scout (visão). */
export async function groqVision(dataUrl: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY não configurada");
  const res = await groqFetchRetry(
    GROQ_URL,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Descreva objetivamente em português o que há nesta imagem. Transcreva TODOS os textos, números e valores visíveis (recibos, listas, telas). Sem opinião, só o conteúdo.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    },
    "Groq vision",
  );
  const data = (await res.json()) as GroqResponse;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Visão não devolveu descrição");
  return text;
}

/** OCR de uma página (data URL base64) — transcrição pura, teto alto pra página cheia. */
export async function groqOcr(dataUrl: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY não configurada");
  const res = await groqFetchRetry(
    GROQ_URL,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 2048,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcreva fielmente TODO o texto desta página de livro, na ordem de leitura. Devolva apenas o texto — sem descrever a imagem, sem comentários, sem cabeçalhos seus.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    },
    "Groq OCR",
  );
  const data = (await res.json()) as GroqResponse;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OCR não devolveu texto");
  return text;
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
