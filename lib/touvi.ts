// Cliente do assistente Touvi. Usa a API da Z.ai (compatível com OpenAI); o
// modelo `glm-4.7-flash` é gratuito. Trocar por "glm-5.2" (pago) melhora a
// qualidade sem mexer em mais nada. A key vive SÓ no servidor (ZAI_API_KEY).
const ZAI_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const MODEL = "glm-4.7-flash";

export const TOUVI_SYSTEM =
  "Você é o Touvi, o assistente pessoal do app Touvie — um 'life OS' que reúne " +
  "rotina, metas, finanças, treino, dieta, diário e leitura da pessoa. " +
  "Fale sempre português do Brasil, num tom caloroso, direto e encorajador, sem " +
  "enrolação nem excesso de emoji. Respostas curtas e úteis. Por enquanto você " +
  "NÃO tem acesso aos dados do usuário (isso vem numa próxima fase) — se pedirem " +
  "algo que dependa disso, seja honesto e diga que essa parte ainda está por vir. " +
  "Nunca invente números.";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export async function touviReply(history: ChatMessage[]): Promise<string> {
  const key = process.env.ZAI_API_KEY;
  if (!key) throw new Error("ZAI_API_KEY não configurada");

  const res = await fetch(ZAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      // glm-4.7-flash é "pensante" por padrão e gastaria todo o orçamento de
      // tokens raciocinando (resposta vinha vazia). Pra chat curto não
      // precisamos de chain-of-thought — desligado fica rápido e direto.
      thinking: { type: "disabled" },
      messages: [{ role: "system", content: TOUVI_SYSTEM }, ...history],
      temperature: 0.8,
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Z.ai ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Resposta vazia do modelo");
  return text;
}
