import { type GroqResponse, groqChat } from "@/lib/groq";
import type { ChatMessage } from "@/lib/toube";

const SUMMARY_SYSTEM =
  "Você resume conversas entre uma pessoa e o Toube (assistente de um app de organização pessoal). Produza um RESUMO CONCISO em português que preserve: fatos e dados que a pessoa deu, decisões tomadas, preferências, tarefas/metas citadas e assuntos ainda em aberto. Mantenha nomes, números e datas exatos. NÃO invente nada, NÃO comente, NÃO use saudação — devolva só o resumo corrido. Se já houver um resumo anterior, INCORPORE as mensagens novas nele (não repita, funda tudo num resumo único e atualizado).";

/**
 * Funde o resumo rolante atual com as mensagens antigas que estão saindo da
 * janela, devolvendo um novo resumo único. Função pura: não toca no banco.
 */
export async function summarizeConversation(
  existingSummary: string | null,
  older: ChatMessage[],
): Promise<string> {
  const transcript = older
    .map((m) => `${m.role === "user" ? "Pessoa" : "Toube"}: ${m.content}`)
    .join("\n");
  const userContent = existingSummary
    ? `Resumo até agora:\n${existingSummary}\n\nNovas mensagens a incorporar:\n${transcript}`
    : `Mensagens a resumir:\n${transcript}`;
  const resp: GroqResponse = await groqChat({
    temperature: 0.2,
    max_tokens: 700,
    messages: [
      { role: "system", content: SUMMARY_SYSTEM },
      { role: "user", content: userContent },
    ],
  });
  return resp.choices?.[0]?.message?.content?.trim() ?? "";
}
