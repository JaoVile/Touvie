// Cliente do assistente Toube. Usa a API da Z.ai (compatível com OpenAI); o
// modelo `glm-4.7-flash` é gratuito. Trocar por "glm-5.2" (pago) melhora a
// qualidade sem mexer em mais nada. A key vive SÓ no servidor (ZAI_API_KEY).
const ZAI_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const MODEL = "glm-4.7-flash";

export const TOUBE_SYSTEM = `Você é o Toube, o assistente que vive dentro do Touvie — o app onde a pessoa organiza a vida num lugar só. Você é o parceiro dela ali dentro: ajuda a pensar, a se organizar e a dar o próximo passo.

JEITO DE FALAR: português do Brasil, natural e humano, como um amigo que torce por ela — caloroso e direto, sem formalidade de robô, sem chavão, sem encher de emoji. NUNCA use termos em inglês soltos (nada de "Life OS"); fale "seu Touvie" ou "sua organização". Respostas curtas e vivas.

O QUE VOCÊ CONHECE DO TOUVIE — aponte o módulo certo quando o assunto surgir:
- Rotina: blocos de hábito e tarefa do dia, com marcação de concluído.
- Metas: objetivos de curto e longo prazo, com acompanhamento. Você VÊ as metas ativas da pessoa (listadas no fim deste texto).
- Diário: registros do dia + humor, protegido por PIN — PRIVADO. Você NUNCA lê nem escreve no Diário; se pedirem, diga com carinho que o diário é só da pessoa e você não acessa.
- Finanças: lançamentos, contas a pagar, caixinhas (envelopes de dinheiro) e gráficos.
- Treino: séries, cargas, recordes pessoais (PRs) e progressão.
- Dieta: refeições, macros e medidas do corpo.
- Notas: bloco de notas rápido.
- Notificações: lembretes que chegam pelo Telegram.

CONDUTAS (como você orienta):
- Conecte a conversa às metas ativas dela (você as conhece).
- Quebre meta grande no próximo passo concreto e pequeno.
- Pergunte sobre bloqueios e qual o próximo passo mínimo.
- Celebre progresso, mas seja honesto: não puxe saco nem invente números.
- Se ela não tem metas, incentive a criar uma no módulo Metas.

O QUE VOCÊ PODE FAZER: você pode CRIAR metas e tarefas pra pessoa. Quando ela pedir ("cria uma meta de X", "adiciona a tarefa Y"), chame a ferramenta certa (criar_meta ou criar_tarefa) com os argumentos — a pessoa CONFIRMA antes de salvar, então proponha sem medo. Só chame a ferramenta quando ela realmente quiser criar algo; pra conversa normal, responda em texto. Pra registrar gasto, treino, refeição etc. (que você ainda não faz), oriente a abrir o módulo certo. Use SOMENTE os dados passados abaixo; nunca invente metas, prazos ou números.`;

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

/** Ações que o Toube pode PROPOR (a pessoa confirma antes de executar). */
export type ToubeAction = "criar_meta" | "criar_tarefa";

/** Resultado do turno: ou texto puro, ou uma PROPOSTA de ação a confirmar. */
export type ToubeResult =
  | { kind: "text"; text: string }
  | { kind: "proposal"; text: string; action: ToubeAction; args: Record<string, unknown> };

// Ferramentas expostas ao modelo (schema OpenAI). Só CRIAR, por ora (1º slice).
const TOOLS = [
  {
    type: "function",
    function: {
      name: "criar_meta",
      description:
        "Cria uma nova meta (objetivo) da pessoa no módulo Metas. Use quando a pessoa quiser registrar/criar uma meta.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título curto da meta" },
          description: { type: "string", description: "Descrição opcional" },
          target_date: { type: "string", description: "Prazo no formato YYYY-MM-DD (opcional)" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_tarefa",
      description:
        "Cria uma nova tarefa no módulo Metas. Use quando a pessoa quiser registrar/criar uma tarefa a fazer.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título curto da tarefa" },
          due_date: { type: "string", description: "Data-limite YYYY-MM-DD (opcional)" },
        },
        required: ["title"],
      },
    },
  },
];

function proposalText(action: ToubeAction, args: Record<string, unknown>): string {
  const title = String(args.title ?? "");
  if (action === "criar_meta") {
    const prazo = args.target_date ? ` com prazo ${args.target_date}` : "";
    return `Posso criar a meta "${title}"${prazo} — é só confirmar. ✅`;
  }
  const prazo = args.due_date ? ` (até ${args.due_date})` : "";
  return `Posso criar a tarefa "${title}"${prazo} — é só confirmar. ✅`;
}

export async function toubeReply(
  history: ChatMessage[],
  metasContext?: string,
): Promise<ToubeResult> {
  const key = process.env.ZAI_API_KEY;
  if (!key) throw new Error("ZAI_API_KEY não configurada");
  // O contexto das metas ativas entra no system prompt (montado pelo route handler).
  const system = metasContext ? `${TOUBE_SYSTEM}\n\n${metasContext}` : TOUBE_SYSTEM;

  const res = await fetch(ZAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      // Thinking off (chat curto); tool calling funciona mesmo assim (confirmado).
      thinking: { type: "disabled" },
      tools: TOOLS,
      tool_choice: "auto",
      messages: [{ role: "system", content: system }, ...history],
      temperature: 0.8,
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Z.ai ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: {
      message?: {
        content?: string;
        tool_calls?: { function?: { name?: string; arguments?: string } }[];
      };
    }[];
  };
  const msg = data.choices?.[0]?.message;

  // Se o modelo decidiu agir, vira uma PROPOSTA (não executa aqui).
  const tc = msg?.tool_calls?.find(
    (t) => t.function?.name === "criar_meta" || t.function?.name === "criar_tarefa",
  );
  if (tc?.function?.name) {
    const action = tc.function.name as ToubeAction;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.function.arguments || "{}");
    } catch {
      /* args inválidos — a validação no confirmar barra */
    }
    const text = msg?.content?.trim() || proposalText(action, args);
    return { kind: "proposal", text, action, args };
  }

  const text = msg?.content?.trim();
  if (!text) throw new Error("Resposta vazia do modelo");
  return { kind: "text", text };
}
