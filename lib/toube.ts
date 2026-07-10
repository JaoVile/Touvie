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

O QUE VOCÊ FAZ (no módulo Metas): você mesmo CRIA, EDITA, CONCLUI e DELETA metas e tarefas — chamando a ferramenta (criar_meta, editar_meta, concluir_meta, deletar_meta, criar_tarefa, concluir_tarefa, deletar_tarefa). Pra editar/concluir/deletar, pegue o "id" da lista do contexto e mande junto (no concluir/deletar mande também o "titulo", só pra exibir). Pode propor VÁRIAS ações de uma vez. A pessoa CONFIRMA cada uma no app antes de executar — então proponha sem medo, INCLUSIVE apagar.

REGRAS ABSOLUTAS (não quebre nenhuma):
1. Você CONSEGUE apagar, editar e concluir meta/tarefa pela conversa. NUNCA diga "não consigo remover/editar pela conversa" nem "abra o módulo Metas pra fazer isso" — isso é MENTIRA, você faz sozinho pela ferramenta.
2. Se uma meta/tarefa está na lista do contexto, ela EXISTE agora. Pra mexer nela, CHAME a ferramenta com o id EXATO. NUNCA responda que "já foi feita/removida/concluída".
3. NUNCA peça confirmação em texto — o app já mostra o botão de confirmar. Só chame a ferramenta e deixe a pessoa confirmar lá.
4. Só chame ferramenta quando a pessoa quiser agir; pra conversa normal, responda em texto.

Pra gasto, treino, refeição, diário etc. (que você ainda NÃO faz), aí sim oriente a abrir o módulo certo. Use SOMENTE os dados passados abaixo; nunca invente metas, prazos, ids ou números.`;

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

/** Ações que o Toube pode PROPOR (a pessoa confirma antes de executar). */
export type ToubeAction =
  | "criar_meta"
  | "editar_meta"
  | "concluir_meta"
  | "deletar_meta"
  | "criar_tarefa"
  | "concluir_tarefa"
  | "deletar_tarefa";

/** Ações destrutivas — o card pede confirmação reforçada (vermelho). */
export const DESTRUCTIVE_ACTIONS: ToubeAction[] = ["deletar_meta", "deletar_tarefa"];

export type ToubeProposal = { action: ToubeAction; args: Record<string, unknown> };

/** Resultado do turno: texto puro, ou uma ou mais PROPOSTAS a confirmar. */
export type ToubeResult =
  | { kind: "text"; text: string }
  | { kind: "proposals"; text: string; proposals: ToubeProposal[] };

const ACTION_NAMES: ToubeAction[] = [
  "criar_meta",
  "editar_meta",
  "concluir_meta",
  "deletar_meta",
  "criar_tarefa",
  "concluir_tarefa",
  "deletar_tarefa",
];

const idParam = { type: "string", description: "id da meta/tarefa (copiado da lista no contexto)" };
const tituloParam = { type: "string", description: "título dela — só pra exibir na confirmação" };

// Ferramentas expostas ao modelo (schema OpenAI). Editar/concluir/deletar usam o `id`
// que vem no contexto das metas/tarefas ativas.
const TOOLS = [
  {
    type: "function",
    function: {
      name: "criar_meta",
      description: "Cria uma nova meta (objetivo) no módulo Metas.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título curto da meta" },
          description: { type: "string", description: "Descrição opcional" },
          target_date: { type: "string", description: "Prazo YYYY-MM-DD (opcional)" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "editar_meta",
      description: "Edita uma meta existente (título, descrição e/ou prazo). Passe o id.",
      parameters: {
        type: "object",
        properties: {
          id: idParam,
          title: { type: "string", description: "Novo título (opcional)" },
          description: { type: "string", description: "Nova descrição (opcional)" },
          target_date: { type: "string", description: "Novo prazo YYYY-MM-DD (opcional)" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "concluir_meta",
      description: "Marca uma meta como concluída. Passe o id.",
      parameters: {
        type: "object",
        properties: { id: idParam, titulo: tituloParam },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deletar_meta",
      description: "Apaga uma meta de vez (irreversível). Passe o id.",
      parameters: {
        type: "object",
        properties: { id: idParam, titulo: tituloParam },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_tarefa",
      description: "Cria uma nova tarefa no módulo Metas.",
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
  {
    type: "function",
    function: {
      name: "concluir_tarefa",
      description: "Marca uma tarefa como feita. Passe o id.",
      parameters: {
        type: "object",
        properties: { id: idParam, titulo: tituloParam },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deletar_tarefa",
      description: "Apaga uma tarefa de vez (irreversível). Passe o id.",
      parameters: {
        type: "object",
        properties: { id: idParam, titulo: tituloParam },
        required: ["id"],
      },
    },
  },
];

/** Frase humana de uma proposta (fallback quando o modelo não manda texto). */
function proposalText(p: ToubeProposal): string {
  const t = String(p.args.title ?? p.args.titulo ?? "");
  switch (p.action) {
    case "criar_meta":
      return `criar a meta "${t}"${p.args.target_date ? ` (prazo ${p.args.target_date})` : ""}`;
    case "editar_meta":
      return "editar essa meta";
    case "concluir_meta":
      return `concluir a meta "${t}"`;
    case "deletar_meta":
      return `apagar a meta "${t}"`;
    case "criar_tarefa":
      return `criar a tarefa "${t}"${p.args.due_date ? ` (até ${p.args.due_date})` : ""}`;
    case "concluir_tarefa":
      return `concluir a tarefa "${t}"`;
    case "deletar_tarefa":
      return `apagar a tarefa "${t}"`;
  }
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

  // Se o modelo decidiu agir, vira uma ou mais PROPOSTAS (não executa aqui). Aceita
  // várias tool_calls no mesmo turno ("cria a meta X e 3 tarefas").
  const proposals: ToubeProposal[] = (msg?.tool_calls ?? [])
    .filter((t) => ACTION_NAMES.includes(t.function?.name as ToubeAction))
    .map((tc) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function?.arguments || "{}");
      } catch {
        /* args inválidos — a validação no confirmar barra */
      }
      return { action: tc.function?.name as ToubeAction, args };
    });

  if (proposals.length) {
    const text =
      msg?.content?.trim() ||
      `Posso ${proposals.map(proposalText).join("; e ")} — é só confirmar abaixo. ✅`;
    return { kind: "proposals", text, proposals };
  }

  const text = msg?.content?.trim();
  if (!text) throw new Error("Resposta vazia do modelo");
  return { kind: "text", text };
}
