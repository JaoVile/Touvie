// Visão via Gemini (Google AI Studio, free tier). Usada pelo OCR da leitura
// (`geminiOcr`) e pelo anexo-imagem do Toube (`geminiVision`). A key vive só no
// servidor (GEMINI_API_KEY, gerada em https://aistudio.google.com/apikey — grátis).
// Substitui o Z.ai glm-4.5v (pago, exigia saldo → degradava 503). O free tier tem
// limite de requisições/dia; sem key ou estourando o limite, o chamador degrada (503).
// Alias que aponta sempre pro flash mais recente utilizável — evita que a
// integração "apodreça" quando o Google aposenta um modelo pinado (ex.: 2.5-flash
// virou "no longer available to new users"). Trocar por um ID fixo se precisar
// travar comportamento.
const MODEL = "gemini-flash-latest";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type GeminiResponse = {
	candidates?: { content?: { parts?: { text?: string }[] } }[];
};

// Quebra um data URL (data:image/png;base64,AAAA) em mime + base64 puro,
// que é o formato inline_data que o Gemini espera.
function splitDataUrl(dataUrl: string): { mimeType: string; data: string } {
	const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
	if (!m) throw new Error("data URL inválido");
	return { mimeType: m[1], data: m[2] };
}

async function geminiVisionCall(
	dataUrl: string,
	prompt: string,
	maxTokens: number,
): Promise<string> {
	const key = process.env.GEMINI_API_KEY;
	if (!key) throw new Error("GEMINI_API_KEY não configurada");
	const { mimeType, data } = splitDataUrl(dataUrl);
	const res = await fetch(API_URL, {
		method: "POST",
		// Key no header (não na URL) — a doc atual do Gemini usa x-goog-api-key e
		// assim a chave não vaza em logs de acesso/proxy.
		headers: { "Content-Type": "application/json", "x-goog-api-key": key },
		body: JSON.stringify({
			contents: [
				{
					parts: [
						{ text: prompt },
						{ inline_data: { mime_type: mimeType, data } },
					],
				},
			],
			generationConfig: { temperature: 0, maxOutputTokens: maxTokens },
		}),
	});
	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		throw new Error(`Gemini visão ${res.status}: ${detail.slice(0, 200)}`);
	}
	const dataRes = (await res.json()) as GeminiResponse;
	const text = dataRes.candidates?.[0]?.content?.parts
		?.map((p) => p.text ?? "")
		.join("")
		.trim();
	if (!text) throw new Error("Visão não devolveu texto");
	return text;
}

// ⚠️ Os modelos Gemini 3.x (pra onde gemini-flash-latest aponta) têm "thinking"
// obrigatório: o raciocínio consome ~200-300 tokens do maxOutputTokens ANTES do
// texto final. Se o teto for apertado, o thinking come tudo e a resposta trunca
// (ou vem vazia, finishReason MAX_TOKENS). Por isso os tetos abaixo são folgados —
// e NÃO mandamos thinkingConfig (thinkingBudget:0 dá 400 no 3.x, e omitir mantém a
// lib compatível caso o alias volte a apontar pra um modelo sem thinking).

/** Descreve/transcreve uma imagem (data URL base64) em PT-BR — anexo do Toube. */
export function geminiVision(dataUrl: string): Promise<string> {
	return geminiVisionCall(
		dataUrl,
		"Descreva objetivamente em português o que há nesta imagem. Transcreva TODOS os textos, números e valores visíveis (recibos, listas, telas). Sem opinião, só o conteúdo.",
		1024,
	);
}

/** OCR de uma página de livro (data URL base64) — transcrição pura, teto alto. */
export function geminiOcr(dataUrl: string): Promise<string> {
	return geminiVisionCall(
		dataUrl,
		"Transcreva fielmente TODO o texto desta página de livro, na ordem de leitura. Devolva apenas o texto — sem descrever a imagem, sem comentários, sem cabeçalhos seus.",
		4096,
	);
}
