import { type GroqResponse, groqChat } from "@/lib/groq";
import type { ChatMessage, ToubeLocale } from "@/lib/toube";

const SUMMARY_SYSTEM_PT =
  "Você resume conversas entre uma pessoa e o Toube (assistente de um app de organização pessoal). Produza um RESUMO CONCISO em português que preserve: fatos e dados que a pessoa deu, decisões tomadas, preferências, tarefas/metas citadas e assuntos ainda em aberto. Mantenha nomes, números e datas exatos. NÃO invente nada, NÃO comente, NÃO use saudação — devolva só o resumo corrido. Se já houver um resumo anterior, INCORPORE as mensagens novas nele (não repita, funda tudo num resumo único e atualizado).";

// O resumo volta pro prompt como contexto de sistema — se ele vier em PT numa
// conversa em EN, o glm começa a responder em PT no meio. Por isso o resumo é
// escrito no idioma da conversa.
const SUMMARY_SYSTEM_EN =
  "You summarize conversations between a person and Toube (the assistant inside a personal organization app). Produce a CONCISE SUMMARY in English that preserves: facts and data the person gave, decisions made, preferences, tasks/goals mentioned and open threads. Keep names, numbers and dates exact — and keep titles the person wrote in their own words untranslated. Do NOT invent anything, do NOT comment, do NOT greet — return only the running summary. If a previous summary already exists, MERGE the new messages into it (do not repeat; fold everything into a single updated summary).";

/**
 * Funde o resumo rolante atual com as mensagens antigas que estão saindo da
 * janela, devolvendo um novo resumo único. Função pura: não toca no banco.
 */
export async function summarizeConversation(
  existingSummary: string | null,
  older: ChatMessage[],
  locale: ToubeLocale = "pt-BR",
): Promise<string> {
  const transcript = older
    .map(
      (m) =>
        `${m.role === "user" ? (locale === "en" ? "Person" : "Pessoa") : "Toube"}: ${m.content}`,
    )
    .join("\n");
  const userContent =
    locale === "en"
      ? existingSummary
        ? `Summary so far:\n${existingSummary}\n\nNew messages to merge in:\n${transcript}`
        : `Messages to summarize:\n${transcript}`
      : existingSummary
        ? `Resumo até agora:\n${existingSummary}\n\nNovas mensagens a incorporar:\n${transcript}`
        : `Mensagens a resumir:\n${transcript}`;
  const resp: GroqResponse = await groqChat({
    temperature: 0.2,
    max_tokens: 700,
    messages: [
      { role: "system", content: locale === "en" ? SUMMARY_SYSTEM_EN : SUMMARY_SYSTEM_PT },
      { role: "user", content: userContent },
    ],
  });
  return resp.choices?.[0]?.message?.content?.trim() ?? "";
}
