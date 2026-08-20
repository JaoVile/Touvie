import { type ChatMessage, type ToubeLocale, type ToubeResult, toubeReply } from "@/lib/toube";
import { summarizeConversation } from "@/lib/toube-compact";
import type { ToubeCtx } from "@/lib/toube-ctx";
import { executeToubeRead } from "@/lib/toube-reads";

// Quantas mensagens do histórico mandar ao modelo (segura custo/contexto).
const HISTORY_WINDOW = 20;
// Ao cruzar este total de mensagens cruas numa sessão, as mais antigas são
// resumidas no summary rolante e podadas — mantém ~HISTORY_WINDOW vivas.
const COMPACT_TRIGGER = 30;

/**
 * Compacta a sessão se ela passou do limiar: resume as mais antigas num resumo
 * rolante e só DEPOIS de salvar poda as cruas. Falha do resumo → não poda nada
 * (nunca perde mensagem por erro do modelo). Devolve o resumo vigente.
 */
async function compactIfNeeded(
  ctx: ToubeCtx,
  sessionId: string,
  locale: ToubeLocale,
): Promise<string | null> {
  const { data: sRow } = await ctx.supabase
    .from("toube_sessions")
    .select("summary")
    .eq("id", sessionId)
    .eq("user_id", ctx.userId)
    .single();
  let sessionSummary: string | null = sRow?.summary ?? null;

  const { count: rawCount } = await ctx.supabase
    .from("toube_messages")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("user_id", ctx.userId);

  if ((rawCount ?? 0) < COMPACT_TRIGGER) return sessionSummary;

  const dropN = (rawCount ?? 0) - HISTORY_WINDOW;
  const { data: oldest } = await ctx.supabase
    .from("toube_messages")
    .select("id, role, content")
    .eq("session_id", sessionId)
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: true })
    .limit(dropN);
  if (!oldest || oldest.length === 0) return sessionSummary;

  try {
    const newSummary = await summarizeConversation(
      sessionSummary,
      oldest.map((m) => ({ role: m.role, content: m.content })),
      locale,
    );
    if (newSummary) {
      const { error: upErr } = await ctx.supabase
        .from("toube_sessions")
        .update({ summary: newSummary })
        .eq("id", sessionId)
        .eq("user_id", ctx.userId);
      if (upErr) throw upErr; // resumo não salvou → não poda nada
      await ctx.supabase
        .from("toube_messages")
        .delete()
        .in(
          "id",
          oldest.map((m) => m.id),
        )
        .eq("user_id", ctx.userId);
      sessionSummary = newSummary;
    }
  } catch {
    // Groq fora: mantém as cruas, segue a rodada normal.
  }
  return sessionSummary;
}

/**
 * Metas + tarefas ativas, categorias e exercícios da pessoa — o Toube usa pra
 * orientar E pra editar/concluir/deletar (por isso vai o id de cada uma).
 * Limitado e truncado pra segurar tokens e dado enviado ao modelo.
 */
// Rótulos do contexto. Ficam no idioma da conversa porque prompt bilíngue faz o
// glm-flash vazar pro outro idioma no meio da resposta — os DADOS (títulos das
// metas, categorias, exercícios) nunca são traduzidos: são a fala da pessoa.
const CTX_LABELS = {
  "pt-BR": {
    header: (dia: string, data: string, hora: string) =>
      `Hoje é ${dia}, ${data}, e agora são ${hora} (horário de Brasília).`,
    goals: "METAS ATIVAS (use o id pra editar/concluir/deletar):",
    noGoals: "A pessoa ainda não tem metas ativas.",
    due: (d: string) => ` (prazo: ${d})`,
    tasks: "TAREFAS ABERTAS (use o id pra concluir/deletar):",
    taskDue: (d: string) => ` (até ${d})`,
    cats: "CATEGORIAS DE FINANÇAS (mande o id no lancar_transacao quando a fala casar):",
    income: "receita",
    expense: "gasto",
    exercises: "EXERCÍCIOS DO CATÁLOGO (use o id no logar_serie; só existe o que está aqui):",
    weekdayLocale: "pt-BR",
  },
  en: {
    header: (dia: string, data: string, hora: string) =>
      `Today is ${dia}, ${data}, and it is now ${hora} (Brasília time).`,
    goals: "ACTIVE GOALS (use the id to edit/complete/delete):",
    noGoals: "This person has no active goals yet.",
    due: (d: string) => ` (due: ${d})`,
    tasks: "OPEN TASKS (use the id to complete/delete):",
    taskDue: (d: string) => ` (by ${d})`,
    cats: "FINANCE CATEGORIES (send the id in lancar_transacao when the message matches one):",
    income: "income",
    expense: "expense",
    exercises: "EXERCISE CATALOG (use the id in logar_serie; nothing outside this list exists):",
    weekdayLocale: "en-US",
  },
} as const;

export async function buildMetasContext(
  ctx: ToubeCtx,
  locale: ToubeLocale = "pt-BR",
): Promise<{
  metasContext: string;
  exercises: { id: string; name: string; muscle_group: string | null }[];
}> {
  const L = CTX_LABELS[locale];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const agora = new Date().toLocaleTimeString("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  const [{ data: goals }, { data: tasks }, { data: cats }, { data: exercises }] = await Promise.all(
    [
      ctx.supabase
        .from("goals")
        .select("id, title, description, target_date")
        .eq("user_id", ctx.userId)
        .eq("status", "active")
        .order("sort_order")
        .limit(20),
      ctx.supabase
        .from("tasks")
        .select("id, title, due_date")
        .eq("user_id", ctx.userId)
        .eq("done", false)
        .order("created_at")
        .limit(30),
      ctx.supabase
        .from("finance_categories")
        .select("id, name, kind")
        .eq("user_id", ctx.userId)
        .eq("archived", false)
        .limit(40),
      ctx.supabase
        .from("exercises")
        .select("id, name, muscle_group")
        .eq("user_id", ctx.userId)
        .limit(60),
    ],
  );

  const metasBlock =
    goals && goals.length > 0
      ? `${L.goals}\n${goals
          .map((g) => {
            const prazo = g.target_date ? L.due(g.target_date) : "";
            const desc = g.description ? ` — ${g.description.slice(0, 160)}` : "";
            return `- [id ${g.id}] "${g.title}"${prazo}${desc}`;
          })
          .join("\n")}`
      : L.noGoals;
  const tasksBlock =
    tasks && tasks.length > 0
      ? `\n\n${L.tasks}\n${tasks
          .map((t) => `- [id ${t.id}] "${t.title}"${t.due_date ? L.taskDue(t.due_date) : ""}`)
          .join("\n")}`
      : "";
  const catsBlock =
    cats && cats.length > 0
      ? `\n\n${L.cats}\n${cats
          .map((c) => `- [id ${c.id}] "${c.name}" (${c.kind === "income" ? L.income : L.expense})`)
          .join("\n")}`
      : "";
  const exercisesBlock =
    exercises && exercises.length > 0
      ? `\n\n${L.exercises}\n${exercises
          .map((e) => `- [id ${e.id}] "${e.name}"${e.muscle_group ? ` (${e.muscle_group})` : ""}`)
          .join("\n")}`
      : "";
  const diaSemana = new Date().toLocaleDateString(L.weekdayLocale, {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
  });

  return {
    metasContext: `${L.header(diaSemana, today, agora)}\n\n${metasBlock}${tasksBlock}${catsBlock}${exercisesBlock}`,
    exercises: exercises ?? [],
  };
}

/**
 * Um turno completo: compacta se precisar, monta o contexto, chama o modelo,
 * corrige o nome do exercício e grava a resposta do assistente.
 * A mensagem do usuário já tem que estar gravada pelo chamador.
 */
export async function runToubeTurn(
  ctx: ToubeCtx,
  opts: { sessionId: string },
): Promise<{ result: ToubeResult; assistantMessageId: string | null }> {
  // Idioma da conversa = o mesmo `profiles.locale` que manda no next-intl, então o
  // Toube fala a língua da interface — inclusive no Telegram, que não tem cookie.
  const { data: prof } = await ctx.supabase
    .from("profiles")
    .select("locale")
    .eq("id", ctx.userId)
    .single();
  const locale: ToubeLocale = prof?.locale === "en" ? "en" : "pt-BR";

  const sessionSummary = await compactIfNeeded(ctx, opts.sessionId, locale);

  // Histórico recente DESSA SESSÃO (o modelo só vê a conversa atual — anti-alucinação).
  const { data: rows } = await ctx.supabase
    .from("toube_messages")
    .select("role, content")
    .eq("user_id", ctx.userId)
    .eq("session_id", opts.sessionId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_WINDOW);
  const history = ((rows ?? []) as ChatMessage[]).reverse();

  // O resumo rolante entra como contexto de sistema ANTES da janela viva, então
  // o modelo mantém o fio mesmo depois da poda.
  const historyForModel: ChatMessage[] = sessionSummary
    ? [
        {
          role: "system",
          content:
            locale === "en"
              ? `[Summary of the conversation so far]\n${sessionSummary}`
              : `[Resumo da conversa até aqui]\n${sessionSummary}`,
        },
        ...history,
      ]
    : history;

  const { metasContext, exercises } = await buildMetasContext(ctx, locale);

  // ATENÇÃO: `ctx.supabase` NÃO é garantidamente o client de cookie. Na web é o
  // de RLS; no webhook do Telegram (que não tem cookie) é o ADMIN, service_role,
  // que bypassa RLS. Por isso toda consulta lá dentro filtra `user_id`
  // explicitamente — o RLS aqui é rede de proteção, não o filtro.
  const result = await toubeReply(
    historyForModel,
    metasContext,
    (tool, args) => executeToubeRead(ctx.supabase, ctx.userId, tool, args),
    locale,
  );

  // logar_serie: o modelo às vezes casa o exercício ERRADO (chumba um id do
  // catálogo pra algo que a pessoa nem citou). O id é a fonte da verdade —
  // reescreve o nome exibido com o nome REAL do id pra confirmação ser honesta.
  // Se o id nem está no catálogo, marca pra barrar no execute.
  if (result.kind === "proposals") {
    const exName = new Map(exercises.map((e) => [e.id, e.name]));
    for (const p of result.proposals) {
      if (p.action !== "logar_serie") continue;
      const real = exName.get(String(p.args.exercise_id));
      p.args.exercicio =
        real ??
        (locale === "en" ? "⚠️ exercise not in the catalog" : "⚠️ exercício fora do catálogo");
      if (!real) p.args.exercise_id = "";
    }
  }

  const { data: saved } = await ctx.supabase
    .from("toube_messages")
    .insert({
      user_id: ctx.userId,
      session_id: opts.sessionId,
      role: "assistant",
      content: result.text,
    })
    .select("id")
    .single();

  return { result, assistantMessageId: saved?.id ?? null };
}
