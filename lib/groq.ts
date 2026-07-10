// Cliente fino do Groq (OpenAI-compatível). Modelo forte e gratuito usado só
// pelo Toube Planos (montar plano estruturado). A key vive só no servidor.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_MODEL = "llama-3.3-70b-versatile";

export type GroqResponse = {
  choices?: {
    message?: {
      content?: string;
      tool_calls?: { function?: { name?: string; arguments?: string } }[];
    };
  }[];
};

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
