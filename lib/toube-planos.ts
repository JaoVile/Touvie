import { groqChat } from "./groq";
import { PLAN_TOOL_NAMES, type Plan, describePlanForModel } from "./planos-draft";
import type { ChatMessage, ToubeLocale } from "./toube";

export type PlanosResult = {
  text: string;
  mutations: { tool: string; args: Record<string, unknown> }[];
};

const PLANOS_SYSTEM = `Você é o Toube montando um PLANO DE TREINO com a pessoa, dentro do Touvie. Fala PT-BR natural e direto.

COMO VOCÊ TRABALHA:
- Você mantém um RASCUNHO do plano (mostrado abaixo, com índices [dia N] e [ex M]).
- Pra montar/editar o rascunho, CHAME as ferramentas (montar_do_zero, add_dia, add_exercicio, editar_exercicio, remover_dia, etc.). NÃO descreva o plano em texto achando que salvou — só a ferramenta muda o rascunho.
- Se a pessoa deu uma FONTE (texto abaixo em "FONTE:"), use-a como base e chame montar_do_zero com o plano inteiro.
- Se faltar informação pra um bom plano (divisão, quantos dias/semana, objetivo, tempo), PERGUNTE em texto — uma coisa por vez, sem encher.
- Exercícios: use nomes claros em PT-BR (ex.: "Supino reto", "Agachamento livre"). Sugira séries e faixa de reps (target_sets, reps_low, reps_high).
- Pra editar/remover, use os índices EXATOS do rascunho atual.

REGRAS:
1. Uma ferramenta por mudança; pode chamar VÁRIAS no mesmo turno (ex.: montar_do_zero já com todos os dias).
2. NUNCA invente que "já cadastrei no app" — o cadastro é um passo final separado que a pessoa confirma. Você só mexe no rascunho.
3. weekday: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb.`;

// Mesmo esquema do chat (ver TOUBE_SYSTEM_EN_OVERRIDE): o prompt afinado fica em
// PT e o inglês entra como última instrução, só trocando o idioma da conversa.
const PLANOS_SYSTEM_EN_OVERRIDE = `LANGUAGE OVERRIDE — this section wins over every language instruction above.

Write to this person in natural American English only — never in Portuguese. The exercise names you propose go in English too ("Barbell bench press", "Back squat"), EXCEPT names the person wrote themselves, which you keep exactly as they typed them.

Everything else stays identical: the same tools, the same rules, the same weekday numbering (0=Sunday … 6=Saturday). Tool names and argument names are code — never translate them.`;

const PLANOS_FALLBACK = {
  "pt-BR": {
    updated: "Atualizei o rascunho aí do lado 👇",
    ask: "Me conta como quer o treino.",
  },
  en: {
    updated: "I updated the draft over there 👇",
    ask: "Tell me how you want to train.",
  },
} as const;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "montar_do_zero",
      description: "Substitui o rascunho inteiro (use ao montar do zero ou a partir da fonte).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          days: {
            type: "array",
            items: {
              type: "object",
              properties: {
                weekday: { type: "number" },
                name: { type: "string" },
                exercises: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      muscle_group: { type: "string" },
                      target_sets: { type: "number" },
                      reps_low: { type: "number" },
                      reps_high: { type: "number" },
                    },
                    required: ["name"],
                  },
                },
              },
              required: ["weekday", "name"],
            },
          },
        },
        required: ["name", "days"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "definir_nome",
      description: "Renomeia o plano.",
      parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    },
  },
  {
    type: "function",
    function: {
      name: "add_dia",
      description: "Adiciona um dia de treino.",
      parameters: {
        type: "object",
        properties: { weekday: { type: "number" }, name: { type: "string" } },
        required: ["weekday", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "editar_dia",
      description: "Edita nome/weekday de um dia pelo índice.",
      parameters: {
        type: "object",
        properties: {
          dia_index: { type: "number" },
          weekday: { type: "number" },
          name: { type: "string" },
        },
        required: ["dia_index"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remover_dia",
      description: "Remove um dia pelo índice.",
      parameters: {
        type: "object",
        properties: { dia_index: { type: "number" } },
        required: ["dia_index"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_exercicio",
      description: "Adiciona um exercício num dia.",
      parameters: {
        type: "object",
        properties: {
          dia_index: { type: "number" },
          name: { type: "string" },
          muscle_group: { type: "string" },
          target_sets: { type: "number" },
          reps_low: { type: "number" },
          reps_high: { type: "number" },
        },
        required: ["dia_index", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "editar_exercicio",
      description: "Edita um exercício de um dia pelos índices.",
      parameters: {
        type: "object",
        properties: {
          dia_index: { type: "number" },
          ex_index: { type: "number" },
          name: { type: "string" },
          muscle_group: { type: "string" },
          target_sets: { type: "number" },
          reps_low: { type: "number" },
          reps_high: { type: "number" },
        },
        required: ["dia_index", "ex_index"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remover_exercicio",
      description: "Remove um exercício de um dia pelos índices.",
      parameters: {
        type: "object",
        properties: { dia_index: { type: "number" }, ex_index: { type: "number" } },
        required: ["dia_index", "ex_index"],
      },
    },
  },
];

export async function planosReply(
  history: ChatMessage[],
  plan: Plan,
  sourceText?: string,
  locale: ToubeLocale = "pt-BR",
): Promise<PlanosResult> {
  const context = sourceText
    ? `${describePlanForModel(plan)}\n\nFONTE (base pro plano — resuma e monte):\n${sourceText.slice(0, 12000)}`
    : describePlanForModel(plan);

  const data = await groqChat({
    tools: TOOLS,
    tool_choice: "auto",
    temperature: 0.6,
    max_tokens: 1500,
    messages: [
      {
        role: "system",
        content:
          locale === "en"
            ? `${PLANOS_SYSTEM}\n\n${context}\n\n${PLANOS_SYSTEM_EN_OVERRIDE}`
            : `${PLANOS_SYSTEM}\n\n${context}`,
      },
      ...history,
    ],
  });

  const msg = data.choices?.[0]?.message;
  const mutations = (msg?.tool_calls ?? [])
    .filter((t) => PLAN_TOOL_NAMES.includes(t.function?.name as (typeof PLAN_TOOL_NAMES)[number]))
    .map((tc) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function?.arguments || "{}");
      } catch {
        /* args inválidos — applyMutation ignora */
      }
      return { tool: tc.function?.name as string, args };
    });

  const fb = PLANOS_FALLBACK[locale];
  const text = msg?.content?.trim() || (mutations.length ? fb.updated : fb.ask);
  return { text, mutations };
}
