// Visão via Z.ai (GLM-4.5V), OpenAI-compatível. Usada pelo OCR da leitura
// (`zaiOcr`) e pelo anexo-imagem do Toube (`zaiVision`). A key vive só no servidor
// (ZAI_API_KEY). ⚠️ glm-4.5v EXIGE saldo/resource package na conta Z.ai — sem saldo
// a API devolve 1113 ("Insufficient balance") e o chamador degrada (503). Antes a
// visão ia pro Groq llama-4-scout, desativado da conta (404 model_not_found).
const ZAI_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const VISION_MODEL = "glm-4.5v";

type ZaiVisionResponse = {
  choices?: { message?: { content?: string } }[];
};

async function zaiVisionCall(dataUrl: string, prompt: string, maxTokens: number): Promise<string> {
  const key = process.env.ZAI_API_KEY;
  if (!key) throw new Error("ZAI_API_KEY não configurada");
  const res = await fetch(ZAI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL,
      thinking: { type: "disabled" }, // sem cadeia de raciocínio — só o texto
      temperature: 0,
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Z.ai visão ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as ZaiVisionResponse;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Visão não devolveu texto");
  return text;
}

/** Descreve/transcreve uma imagem (data URL base64) em PT-BR — anexo do Toube. */
export function zaiVision(dataUrl: string): Promise<string> {
  return zaiVisionCall(
    dataUrl,
    "Descreva objetivamente em português o que há nesta imagem. Transcreva TODOS os textos, números e valores visíveis (recibos, listas, telas). Sem opinião, só o conteúdo.",
    500,
  );
}

/** OCR de uma página de livro (data URL base64) — transcrição pura, teto alto. */
export function zaiOcr(dataUrl: string): Promise<string> {
  return zaiVisionCall(
    dataUrl,
    "Transcreva fielmente TODO o texto desta página de livro, na ordem de leitura. Devolva apenas o texto — sem descrever a imagem, sem comentários, sem cabeçalhos seus.",
    2048,
  );
}
