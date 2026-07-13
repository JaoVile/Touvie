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

O QUE VOCÊ FAZ (pelas ferramentas, com confirmação):
- Metas: CRIAR, EDITAR, CONCLUIR e DELETAR metas e tarefas (use o "id" da lista do contexto pra editar/concluir/deletar; mande "titulo" no concluir/deletar só pra exibir).
- Finanças: LANÇAR gasto (kind=expense) ou receita (kind=income) com lancar_transacao — valor em REAIS. Se a fala casar com uma das categorias do contexto, mande o category_id dela.
- Rotina: ADICIONAR bloco do dia com adicionar_bloco_rotina (hora HH:MM + título).
- Notificações: CRIAR lembrete/alerta com criar_lembrete (hora HH:MM + mensagem) — chega pelo Telegram. Use quando pedirem "me lembra", "cria um alerta", "me notifica" num horário. Se for pra UMA VEZ SÓ (ex.: "hoje às 17:34", "amanhã às 9"), mande também data=YYYY-MM-DD (calcule a partir do "Hoje é" do contexto). Se for recorrente ("todo dia", "sempre"), NÃO mande data — vira diário.
- Notas: CRIAR nota rápida com criar_nota (título + corpo opcional).
- Dieta: REGISTRAR medida do corpo com registrar_medida (peso em kg; cintura_cm e gordura_pct opcionais; data padrão hoje). Ex.: "registra que tô com 82kg".
- Treino: LOGAR uma série com logar_serie (exercise_id do catálogo + carga em kg + reps; rpe opcional). SÓ pra exercício que está na lista EXERCÍCIOS DO CATÁLOGO — mande o id exato. Se a pessoa citar um exercício que NÃO está no catálogo, NÃO invente id: diga que ela precisa criar esse exercício no módulo Treino primeiro.
Pode propor VÁRIAS ações de uma vez. A pessoa CONFIRMA cada uma no app antes de executar — então proponha sem medo, INCLUSIVE apagar.

O QUE VOCÊ CONSULTA (executa NA HORA, sem confirmação — ler não muda nada): quando a pessoa PERGUNTAR sobre os dados dela ("quanto gastei?", "como tá minha rotina?", "qual meu último peso?", "meus recordes?"), CHAME a ferramenta de consulta certa e responda com os números REAIS que ela devolver:
- consultar_financas — saldo, gastos e receitas do mês, categorias, últimos lançamentos.
- consultar_rotina — blocos de hoje e o que já foi concluído.
- consultar_treino — últimas séries logadas e recordes (PRs).
- consultar_dieta — últimas medidas do corpo e refeições de hoje.
- consultar_notas — títulos das notas salvas.
NUNCA invente números: se não consultou, consulte. O DIÁRIO não tem consulta e NUNCA terá.

REGRAS ABSOLUTAS (não quebre nenhuma):
1. Você CONSEGUE apagar, editar e concluir meta/tarefa pela conversa. NUNCA diga "não consigo remover/editar pela conversa" nem "abra o módulo Metas pra fazer isso" — isso é MENTIRA, você faz sozinho pela ferramenta.
2. Se uma meta/tarefa está na lista do contexto, ela EXISTE agora. Pra mexer nela, CHAME a ferramenta com o id EXATO. NUNCA responda que "já foi feita/removida/concluída".
3. NUNCA peça confirmação em texto — o app já mostra o botão de confirmar. Só chame a ferramenta e deixe a pessoa confirmar lá.
4. Só chame ferramenta quando a pessoa quiser agir ou consultar os dados; pra conversa normal, responda em texto.
5. "loguei/fiz/registrei X kg Y reps" É AÇÃO: CHAME logar_serie (não responda "parabéns pela série" em texto). Mas SÓ com um exercise_id que aparece EXATO na lista EXERCÍCIOS DO CATÁLOGO. Se o exercício falado NÃO está na lista, é PROIBIDO mandar o id de outro parecido — responda em texto pedindo pra criar esse exercício no módulo Treino primeiro.

Pra REGISTRAR refeição/comida na dieta (logar alimento) e pro DIÁRIO — que você ainda NÃO faz — oriente a abrir o módulo. O diário é privado, você nunca acessa. Use SOMENTE os dados passados abaixo; nunca invente metas, categorias, ids, exercícios, prazos ou números.`;

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

/** Ações que o Toube pode PROPOR (a pessoa confirma antes de executar). */
export type ToubeAction =
  | "criar_meta"
  | "editar_meta"
  | "concluir_meta"
  | "deletar_meta"
  | "criar_tarefa"
  | "concluir_tarefa"
  | "deletar_tarefa"
  | "lancar_transacao"
  | "adicionar_bloco_rotina"
  | "criar_lembrete"
  | "criar_nota"
  | "registrar_medida"
  | "logar_serie";

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
  "lancar_transacao",
  "adicionar_bloco_rotina",
  "criar_lembrete",
  "criar_nota",
  "registrar_medida",
  "logar_serie",
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
  {
    type: "function",
    function: {
      name: "lancar_transacao",
      description:
        "Lança um GASTO (kind=expense) ou uma RECEITA/entrada (kind=income) no módulo Finanças. Valor em REAIS.",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["expense", "income"],
            description: "expense = gasto; income = receita/entrada de dinheiro",
          },
          valor: {
            type: "number",
            description: "Valor em REAIS (ex.: 50 ou 50.90) — nunca em centavos",
          },
          descricao: { type: "string", description: "Descrição curta (ex.: 'mercado')" },
          data: { type: "string", description: "Data YYYY-MM-DD (opcional; padrão hoje)" },
          category_id: {
            type: "string",
            description: "id da categoria da lista do contexto que MELHOR casa (opcional)",
          },
        },
        required: ["kind", "valor"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adicionar_bloco_rotina",
      description: "Adiciona um bloco de hábito/tarefa no dia (módulo Rotina).",
      parameters: {
        type: "object",
        properties: {
          hora: { type: "string", description: "Horário HH:MM (ex.: 08:00)" },
          titulo: { type: "string", description: "O que é o bloco (ex.: 'Academia')" },
        },
        required: ["hora", "titulo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_lembrete",
      description:
        "Cria um LEMBRETE/ALERTA/NOTIFICAÇÃO que chega pelo Telegram todo dia no mesmo horário (módulo Notificações). Use quando a pessoa pedir pra ser lembrada/avisada/notificada num horário.",
      parameters: {
        type: "object",
        properties: {
          hora: { type: "string", description: "Horário HH:MM (ex.: 17:34)" },
          mensagem: {
            type: "string",
            description: "O texto do lembrete (ex.: 'Beber água', 'Revisar metas')",
          },
          data: {
            type: "string",
            description:
              "Data YYYY-MM-DD SÓ pra lembrete de UMA VEZ (ex.: 'hoje às 17:34', 'amanhã às 9'). Se for TODO DIA, NÃO mande data.",
          },
        },
        required: ["hora", "mensagem"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_nota",
      description: "Cria uma nota rápida no módulo Notas.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título da nota" },
          corpo: { type: "string", description: "Conteúdo/corpo da nota (opcional)" },
        },
        required: ["titulo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_medida",
      description:
        "Registra uma medida do corpo no módulo Dieta (peso e/ou cintura/gordura) numa data.",
      parameters: {
        type: "object",
        properties: {
          peso: { type: "number", description: "Peso em kg (ex.: 82.5)" },
          cintura_cm: { type: "number", description: "Cintura em cm (opcional)" },
          gordura_pct: { type: "number", description: "% de gordura corporal (opcional)" },
          data: { type: "string", description: "Data YYYY-MM-DD (opcional; padrão hoje)" },
        },
        required: ["peso"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "logar_serie",
      description:
        "Loga UMA série de um exercício no treino de hoje (módulo Treino). O exercício PRECISA estar no catálogo do contexto — mande o exercise_id dele. A sessão de hoje e o número da série são resolvidos sozinhos.",
      parameters: {
        type: "object",
        properties: {
          exercise_id: {
            type: "string",
            description: "id do exercício da lista EXERCÍCIOS DO CATÁLOGO que casa com a fala",
          },
          exercicio: { type: "string", description: "Nome do exercício (só pra exibir)" },
          carga: { type: "number", description: "Carga em kg (ex.: 80)" },
          reps: { type: "number", description: "Repetições (ex.: 8)" },
          rpe: { type: "number", description: "Esforço percebido 1-10 (opcional)" },
        },
        required: ["exercise_id", "carga", "reps"],
      },
    },
  },
];

// Consultas (Fase 5): executam na hora via readTool e o resultado volta pro
// modelo num segundo turno. Sem params além do mês em finanças — enxuto.
const READ_TOOLS = [
  {
    type: "function",
    function: {
      name: "consultar_financas",
      description:
        "Consulta as finanças do mês: receitas, gastos, saldo, top categorias e últimos lançamentos. Use quando perguntarem de dinheiro/gasto/saldo.",
      parameters: {
        type: "object",
        properties: {
          mes: { type: "string", description: "Mês YYYY-MM (opcional; padrão mês atual)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_rotina",
      description: "Consulta os blocos da rotina e o que já foi concluído hoje.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_treino",
      description: "Consulta as últimas séries logadas e os recordes pessoais (PRs).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_dieta",
      description: "Consulta as últimas medidas do corpo e as refeições de hoje.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_notas",
      description: "Lista os títulos das notas salvas.",
      parameters: { type: "object", properties: {} },
    },
  },
];

const READ_NAMES = new Set(READ_TOOLS.map((t) => t.function.name));

/** Executor de consulta (injetado pelo route — mantém este módulo sem Supabase). */
export type ToubeReadTool = (name: string, args: Record<string, unknown>) => Promise<string>;

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
    case "lancar_transacao":
      return `lançar ${p.args.kind === "income" ? "a receita" : "o gasto"} de R$ ${p.args.valor}${p.args.descricao ? ` (${p.args.descricao})` : ""}`;
    case "adicionar_bloco_rotina":
      return `adicionar "${p.args.titulo}" na rotina às ${p.args.hora}`;
    case "criar_lembrete":
      return p.args.data
        ? `criar um lembrete: "${p.args.mensagem}" em ${p.args.data} às ${p.args.hora}`
        : `criar um lembrete diário: "${p.args.mensagem}" todo dia às ${p.args.hora}`;
    case "criar_nota":
      return `criar a nota "${p.args.titulo}"`;
    case "registrar_medida":
      return `registrar ${p.args.peso ? `${p.args.peso}kg` : "medida"}${p.args.data ? ` em ${p.args.data}` : ""}`;
    case "logar_serie":
      return `logar ${p.args.exercicio ?? "exercício"}: ${p.args.carga}kg × ${p.args.reps}${p.args.rpe ? ` @RPE${p.args.rpe}` : ""}`;
  }
}

// Mensagem "de fio" da API (inclui os formatos de tool-calling OpenAI que não
// cabem no ChatMessage público: assistant com tool_calls e o resultado role:"tool").
type RawToolCall = { id?: string; function?: { name?: string; arguments?: string } };
type WireMessage =
  | ChatMessage
  | { role: "assistant"; content: string; tool_calls: RawToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

async function zaiChat(messages: WireMessage[]) {
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
      // Thinking off (chat curto); tool calling funciona mesmo assim (confirmado).
      thinking: { type: "disabled" },
      tools: [...TOOLS, ...READ_TOOLS],
      tool_choice: "auto",
      messages,
      temperature: 0.8,
      max_tokens: 700,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Z.ai ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string; tool_calls?: RawToolCall[] } }[];
  };
  return data.choices?.[0]?.message;
}

export async function toubeReply(
  history: ChatMessage[],
  metasContext?: string,
  readTool?: ToubeReadTool,
): Promise<ToubeResult> {
  // O contexto das metas ativas entra no system prompt (montado pelo route handler).
  const system = metasContext ? `${TOUBE_SYSTEM}\n\n${metasContext}` : TOUBE_SYSTEM;
  let messages: WireMessage[] = [{ role: "system", content: system }, ...history];

  // Até 2 chamadas: se a 1ª pedir CONSULTA, executamos e devolvemos o resultado
  // pro modelo responder com os números reais. Ações viram proposta em qualquer
  // uma das rodadas; consulta pedida na 2ª rodada é ignorada (teto de custo).
  for (let round = 0; round < 2; round++) {
    const msg = await zaiChat(messages);
    const calls = msg?.tool_calls ?? [];
    const readCalls = calls.filter((c) => READ_NAMES.has(c.function?.name ?? ""));

    if (round === 0 && readTool && readCalls.length) {
      const toolMsgs: WireMessage[] = [];
      for (const [i, c] of readCalls.entries()) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(c.function?.arguments || "{}");
        } catch {
          /* args inválidos — a consulta usa os padrões */
        }
        const content = await readTool(c.function?.name ?? "", args);
        toolMsgs.push({ role: "tool", tool_call_id: c.id ?? `call_${i}`, content });
      }
      messages = [
        ...messages,
        { role: "assistant", content: msg?.content ?? "", tool_calls: readCalls },
        ...toolMsgs,
      ];
      continue;
    }

    // Se o modelo decidiu agir, vira uma ou mais PROPOSTAS (não executa aqui). Aceita
    // várias tool_calls no mesmo turno ("cria a meta X e 3 tarefas").
    const proposals: ToubeProposal[] = calls
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
  throw new Error("Resposta vazia do modelo");
}
