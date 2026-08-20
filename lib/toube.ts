// Cliente do assistente Toube. Usa a API da Z.ai (compatível com OpenAI); o
// modelo `glm-4.7-flash` é gratuito. Trocar por "glm-5.2" (pago) melhora a
// qualidade sem mexer em mais nada. A key vive SÓ no servidor (ZAI_API_KEY).
const ZAI_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const MODEL = "glm-4.7-flash";

export const TOUBE_SYSTEM = `Você é o Toube, o assistente que vive dentro do Touvie — o app onde a pessoa organiza a vida num lugar só. Você é o parceiro dela ali dentro: ajuda a pensar, a se organizar e a dar o próximo passo.

JEITO DE FALAR: português do Brasil, natural e humano, como um amigo que torce por ela — caloroso e direto, sem formalidade de robô, sem chavão, sem encher de emoji. NUNCA use termos em inglês soltos (nada de "Life OS"); fale "seu Touvie" ou "sua organização". Respostas curtas e vivas. "Toube" é o SEU próprio nome — NUNCA chame a pessoa de "Toube" nem invente um nome pra ela; você não sabe o nome dela, então fale sem nome (ou, se quiser dar calor, "amigo"/"amiga"). Não assine as respostas com o seu nome.

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
- Notificações: CRIAR lembrete/alerta com criar_lembrete (hora HH:MM + mensagem) — chega pelo Telegram. Use quando pedirem "me lembra", "cria um alerta", "me notifica" num horário. REGRA: só é recorrente se a pessoa pedir EXPLICITAMENTE ("todo dia", "sempre") → recorrente=true. Caso contrário recorrente=false e o lembrete vale UMA vez: se ela citou o dia ("amanhã", "dia 15"), mande data=YYYY-MM-DD (calcule pelo "Hoje é" do contexto); se só falou o horário, NÃO mande data — o app agenda a próxima ocorrência sozinho. Pedido RELATIVO ("daqui a 10 minutos", "em 2 horas"): some ao "agora são" do contexto e mande a hora resultante — NUNCA copie horário/texto de lembrete antigo da conversa.
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
Lembrete com CONTEÚDO dos dados (ex.: "me manda meu treino de amanhã às 17:15"): PRIMEIRO consulte (consultar_treino traz o programa por dia da semana), DEPOIS chame criar_lembrete com a mensagem já escrita com o conteúdo real (ex.: "Treino de terça — Peito: Supino 4x8-12 · Crucifixo 3x12"). Nunca mande mensagem vaga tipo "Treino de amanhã" se dá pra consultar o conteúdo.

REGRAS ABSOLUTAS (não quebre nenhuma):
1. Você CONSEGUE apagar, editar e concluir meta/tarefa pela conversa. NUNCA diga "não consigo remover/editar pela conversa" nem "abra o módulo Metas pra fazer isso" — isso é MENTIRA, você faz sozinho pela ferramenta.
2. Se uma meta/tarefa está na lista do contexto, ela EXISTE agora. Pra mexer nela, CHAME a ferramenta com o id EXATO. NUNCA responda que "já foi feita/removida/concluída".
3. NUNCA peça confirmação em texto — o app já mostra o botão de confirmar. Só chame a ferramenta e deixe a pessoa confirmar lá.
4. Só chame ferramenta quando a pessoa quiser agir ou consultar os dados; pra conversa normal, responda em texto.
5. "loguei/fiz/registrei X kg Y reps" É AÇÃO: CHAME logar_serie (não responda "parabéns pela série" em texto). Mas SÓ com um exercise_id que aparece EXATO na lista EXERCÍCIOS DO CATÁLOGO. Se o exercício falado NÃO está na lista, é PROIBIDO mandar o id de outro parecido — responda em texto pedindo pra criar esse exercício no módulo Treino primeiro.
6. "manda/faz uma notificação", "notificação de teste", "me avisa daqui a X" É AÇÃO: CHAME criar_lembrete com a hora certa (relativo = "agora são" + X). Você TEM essa ferramenta — NUNCA diga que não consegue enviar notificação, NUNCA diga "consegui criar" sem chamar a ferramenta, e NUNCA reaproveite texto/horário de lembrete antigo da conversa.

Pra REGISTRAR refeição/comida na dieta (logar alimento) e pro DIÁRIO — que você ainda NÃO faz — oriente a abrir o módulo. O diário é privado, você nunca acessa. Use SOMENTE os dados passados abaixo; nunca invente metas, categorias, ids, exercícios, prazos ou números.`;

/** Idioma da conversa — espelha `profiles.locale` (o mesmo do next-intl). */
export type ToubeLocale = "pt-BR" | "en";

// O prompt principal é escrito em PT porque é nele que o tool-calling do glm foi
// afinado (as REGRAS ABSOLUTAS numeradas). Traduzir tudo quebraria essa afinação,
// então o inglês entra como OVERRIDE colado no FIM: a última instrução é a que o
// modelo obedece. Ele só mexe em idioma — nenhuma regra de ferramenta é reescrita.
export const TOUBE_SYSTEM_EN_OVERRIDE = `LANGUAGE OVERRIDE — this section wins over every language instruction above.

This person uses Touvie in English, so you ALWAYS write in natural American English — warm, direct, like a friend who is rooting for them. The "português do Brasil" rule above does NOT apply to this conversation. Never answer in Portuguese, never mix the two, not even for a single word or a module name.

MODULE NAMES in English: Routine, Goals, Journal, Finances, Workout, Diet, Notes, Reading, Notifications. Say "your Touvie" — never "Life OS". The Journal is still untouchable: you never read it and never write to it; if asked, say kindly that the journal is theirs alone and you have no access.

WHAT STAYS THE SAME: every tool, every ABSOLUTE rule, and when to call each one. Tool NAMES and ARGUMENT names stay exactly as defined (criar_meta, lancar_transacao, hora, mensagem…) — they are code, not words to translate.

DATA IS NOT TRANSLATED: goal, task, category and exercise titles in the context below are the person's own words — quote them EXACTLY as written, in whatever language they are in. Dates stay YYYY-MM-DD, times stay HH:MM (24h), money stays Brazilian reais (R$), weight stays kg.`;

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
          recorrente: {
            type: "boolean",
            description:
              "true SÓ se a pessoa pedir explicitamente repetição ('todo dia', 'sempre', 'diariamente'). Sem pedido explícito, false — o lembrete vale UMA vez.",
          },
          data: {
            type: "string",
            description:
              "Data YYYY-MM-DD se a pessoa citou o dia ('amanhã', 'dia 15'). Se não citou dia e não é recorrente, NÃO mande — o app agenda a próxima ocorrência do horário sozinho.",
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
function proposalTextPt(p: ToubeProposal): string {
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
      return p.args.recorrente
        ? `criar um lembrete diário: "${p.args.mensagem}" todo dia às ${p.args.hora}`
        : p.args.data
          ? `criar um lembrete: "${p.args.mensagem}" em ${p.args.data} às ${p.args.hora}`
          : `criar um lembrete: "${p.args.mensagem}" na próxima ${p.args.hora} (uma vez)`;
    case "criar_nota":
      return `criar a nota "${p.args.titulo}"`;
    case "registrar_medida":
      return `registrar ${p.args.peso ? `${p.args.peso}kg` : "medida"}${p.args.data ? ` em ${p.args.data}` : ""}`;
    case "logar_serie":
      return `logar ${p.args.exercicio ?? "exercício"}: ${p.args.carga}kg × ${p.args.reps}${p.args.rpe ? ` @RPE${p.args.rpe}` : ""}`;
  }
}

// Mesma frase em inglês. Dinheiro segue em R$ e peso em kg — o app é brasileiro,
// só o idioma muda.
function proposalTextEn(p: ToubeProposal): string {
  const t = String(p.args.title ?? p.args.titulo ?? "");
  switch (p.action) {
    case "criar_meta":
      return `create the goal "${t}"${p.args.target_date ? ` (due ${p.args.target_date})` : ""}`;
    case "editar_meta":
      return "edit this goal";
    case "concluir_meta":
      return `complete the goal "${t}"`;
    case "deletar_meta":
      return `delete the goal "${t}"`;
    case "criar_tarefa":
      return `create the task "${t}"${p.args.due_date ? ` (by ${p.args.due_date})` : ""}`;
    case "concluir_tarefa":
      return `complete the task "${t}"`;
    case "deletar_tarefa":
      return `delete the task "${t}"`;
    case "lancar_transacao":
      return `log the ${p.args.kind === "income" ? "income" : "expense"} of R$ ${p.args.valor}${p.args.descricao ? ` (${p.args.descricao})` : ""}`;
    case "adicionar_bloco_rotina":
      return `add "${p.args.titulo}" to your routine at ${p.args.hora}`;
    case "criar_lembrete":
      return p.args.recorrente
        ? `create a daily reminder: "${p.args.mensagem}" every day at ${p.args.hora}`
        : p.args.data
          ? `create a reminder: "${p.args.mensagem}" on ${p.args.data} at ${p.args.hora}`
          : `create a reminder: "${p.args.mensagem}" at the next ${p.args.hora} (once)`;
    case "criar_nota":
      return `create the note "${p.args.titulo}"`;
    case "registrar_medida":
      return `log ${p.args.peso ? `${p.args.peso}kg` : "a measurement"}${p.args.data ? ` on ${p.args.data}` : ""}`;
    case "logar_serie":
      return `log ${p.args.exercicio ?? "exercise"}: ${p.args.carga}kg × ${p.args.reps}${p.args.rpe ? ` @RPE${p.args.rpe}` : ""}`;
  }
}

function proposalText(p: ToubeProposal, locale: ToubeLocale): string {
  return locale === "en" ? proposalTextEn(p) : proposalTextPt(p);
}

// Frases fixas que a gente mesmo escreve quando o modelo não devolve texto.
const FALLBACK = {
  "pt-BR": {
    confirm: (list: string) => `Posso ${list} — é só confirmar abaixo. ✅`,
    joiner: "; e ",
    cannotAct: "Não consegui fazer isso agora — pode pedir de novo, com o horário?",
    cannotAnswer: "Não consegui responder isso agora — pode reformular?",
  },
  en: {
    confirm: (list: string) => `I can ${list} — just confirm below. ✅`,
    joiner: "; and ",
    cannotAct: "I couldn't do that just now — can you ask again, with the time?",
    cannotAnswer: "I couldn't answer that just now — mind rephrasing?",
  },
} as const;

// Mensagem "de fio" da API (inclui os formatos de tool-calling OpenAI que não
// cabem no ChatMessage público: assistant com tool_calls e o resultado role:"tool").
type RawToolCall = {
  id?: string;
  type?: "function";
  function?: { name?: string; arguments?: string };
};
type WireMessage =
  | ChatMessage
  | { role: "assistant"; content: string; tool_calls: RawToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

async function zaiChat(messages: WireMessage[], toolChoice: "auto" | "required" = "auto") {
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
      tool_choice: toolChoice,
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

/**
 * O modelo AFIRMOU ter feito alguma coisa?
 *
 * O glm-4.7-flash (gratuito) às vezes responde "Pronto! Vai chegar às 9:30"
 * SEM emitir a ferramenta — nenhuma proposta é criada, nenhum lembrete existe,
 * e a pessoa fica esperando. O prompt já proíbe isso na regra ABSOLUTA 6 e o
 * modelo ignora; então a checagem tem que ser no código, não na palavra dele.
 *
 * O padrão é DELIBERADAMENTE estreito — primeira pessoa do passado, ou promessa
 * de entrega futura. Falso positivo aqui custa caro (troca uma resposta boa por
 * uma de erro), então é melhor deixar mentira passar do que atrapalhar conversa
 * normal. "Pronto" sozinho, por exemplo, não conta: aparece em "pronto, pode
 * perguntar".
 */
export const CLAIMS_ACTION =
  /\b(criei|marquei|agendei|registrei|lancei|anotei|adicionei|apaguei|deletei|conclu[ií]|salvei|programei)\b|\bvou (marcar|criar|agendar|registrar|lan[çc]ar|anotar|adicionar|apagar|deletar|salvar|programar)\b|vai (chegar|receber|te avisar)|est[áa] (agendad|marcad|criad|salv)|deixei (marcad|agendad|anotad)/i;

// Mesmo guarda em inglês. Sem ele a mentira do glm passava batido no idioma EN —
// "I've created the reminder" não casava com NENHUM verbo da regex PT, então a
// pessoa ficava esperando um lembrete que nunca existiu.
export const CLAIMS_ACTION_EN =
  /\b(created|scheduled|logged|recorded|added|saved|deleted|removed|completed|marked|set up|noted down)\b|\bi(?:'ll| will) (create|schedule|log|record|add|save|delete|remove|complete|mark|set up)\b|\b(?:is|has been|have been) (created|scheduled|logged|added|saved|deleted|removed|completed|set)\b|\byou(?:'ll| will) (get|receive) (a|the|your)\b/i;

/** O texto AFIRMA ter agido? (regex do idioma da conversa) */
function claimsAction(text: string, locale: ToubeLocale): boolean {
  return locale === "en" ? CLAIMS_ACTION_EN.test(text) : CLAIMS_ACTION.test(text);
}

export async function toubeReply(
  history: ChatMessage[],
  metasContext?: string,
  readTool?: ToubeReadTool,
  locale: ToubeLocale = "pt-BR",
): Promise<ToubeResult> {
  // O contexto das metas ativas entra no system prompt (montado pelo route handler).
  // O override de idioma vai POR ÚLTIMO, depois do contexto — última instrução vence.
  const base = metasContext ? `${TOUBE_SYSTEM}\n\n${metasContext}` : TOUBE_SYSTEM;
  const system = locale === "en" ? `${base}\n\n${TOUBE_SYSTEM_EN_OVERRIDE}` : base;
  const fb = FALLBACK[locale];
  let messages: WireMessage[] = [{ role: "system", content: system }, ...history];

  // Até 2 chamadas: se a 1ª pedir CONSULTA, executamos e devolvemos o resultado
  // pro modelo responder com os números reais. Ações pedidas JUNTO da consulta na
  // rodada 0 são guardadas (não podem sumir); consulta pedida na 2ª rodada é ignorada.
  const stashedProposals: ToubeProposal[] = [];

  for (let round = 0; round < 2; round++) {
    const msg = await zaiChat(messages);
    const calls = msg?.tool_calls ?? [];
    const readCalls = calls.filter((c) => READ_NAMES.has(c.function?.name ?? ""));
    const actionProposals: ToubeProposal[] = calls
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

    if (round === 0 && readTool && readCalls.length) {
      // Guarda ações que vieram junto ("vê quanto gastei E lança 50") pra não perder.
      stashedProposals.push(...actionProposals);
      const assistantCalls: RawToolCall[] = [];
      const toolMsgs: WireMessage[] = [];
      for (const [i, c] of readCalls.entries()) {
        // MESMO id no tool_call do assistant e no resultado — senão a API rejeita.
        const id = c.id ?? `call_${i}`;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(c.function?.arguments || "{}");
        } catch {
          /* args inválidos — a consulta usa os padrões */
        }
        const content = await readTool(c.function?.name ?? "", args);
        // Preserva o objeto original (mantém `type:"function"` que a Z.ai exige) e
        // garante o mesmo id do resultado.
        assistantCalls.push({ ...c, id, type: "function" });
        toolMsgs.push({ role: "tool", tool_call_id: id, content });
      }
      messages = [
        ...messages,
        { role: "assistant", content: msg?.content ?? "", tool_calls: assistantCalls },
        ...toolMsgs,
      ];
      continue;
    }

    // Ações guardadas da rodada 0 + as desta rodada (dedup por action+args — o modelo
    // pode reemitir a mesma ação depois de ver o resultado da consulta).
    const merged = [...stashedProposals, ...actionProposals];
    const proposals = merged.filter(
      (p, i) =>
        merged.findIndex(
          (q) => q.action === p.action && JSON.stringify(q.args) === JSON.stringify(p.args),
        ) === i,
    );

    if (proposals.length) {
      const text =
        msg?.content?.trim() ||
        fb.confirm(proposals.map((x) => proposalText(x, locale)).join(fb.joiner));
      return { kind: "proposals", text, proposals };
    }

    const text = msg?.content?.trim();

    // Texto que AFIRMA ter agido, sem nenhuma ferramenta emitida: é a mentira
    // do glm. Não dá pra deixar passar — a pessoa fica esperando um lembrete
    // que nunca foi criado. Uma segunda chance, agora obrigando a ferramenta.
    if (text && claimsAction(text, locale)) {
      const forced = await zaiChat(messages, "required").catch(() => null);
      const forcedProposals: ToubeProposal[] = (forced?.tool_calls ?? [])
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

      if (forcedProposals.length) {
        return {
          kind: "proposals",
          text:
            forced?.content?.trim() ||
            fb.confirm(forcedProposals.map((x) => proposalText(x, locale)).join(fb.joiner)),
          proposals: forcedProposals,
        };
      }

      // Nem forçado ele emitiu (ou emitiu só consulta). Melhor admitir do que
      // repassar a afirmação falsa: quem lê "pronto!" não confere o app depois.
      return {
        kind: "text",
        text: fb.cannotAct,
      };
    }

    if (text) return { kind: "text", text };
    // Sem texto e sem proposta (ex.: modelo repetiu uma consulta na rodada 1):
    // resposta amigável em vez de estourar 502.
    return { kind: "text", text: fb.cannotAnswer };
  }
  return { kind: "text", text: fb.cannotAnswer };
}
