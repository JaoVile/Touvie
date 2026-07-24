import { createClient } from "@/lib/supabase/server";
import { type ChatMessage, type ToubeResult, toubeReply } from "@/lib/toube";
import { summarizeConversation } from "@/lib/toube-compact";
import { executeToubeRead } from "@/lib/toube-reads";
import { NextResponse } from "next/server";
import { z } from "zod";

// Quantas mensagens do histórico mandar ao modelo (segura custo/contexto).
const HISTORY_WINDOW = 20;

// Ao cruzar este total de mensagens cruas numa sessão, as mais antigas são
// resumidas no summary rolante e podadas — mantém ~HISTORY_WINDOW vivas.
const COMPACT_TRIGGER = 30;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(4000).optional(),
  session_id: z.string().uuid(),
  // Editar mensagem JÁ enviada (estilo Gemini): troca o texto dela, PODA tudo que
  // veio depois na sessão e o modelo responde de novo a partir dali.
  edit_message_id: z.string().uuid().optional(),
  // Regenerar: apaga a ÚLTIMA resposta do assistente e gera outra no lugar.
  regenerate: z.boolean().optional(),
});

// Resolve a sessão ativa: a pedida (se for do usuário), senão a mais recente,
// senão cria uma. Garante que sempre há uma sessão pra ler/gravar.
async function activeSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  requested?: string | null,
): Promise<string> {
  if (requested && /^[0-9a-f-]{36}$/i.test(requested)) {
    const { data } = await supabase
      .from("toube_sessions")
      .select("id")
      .eq("id", requested)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return data.id;
  }
  const { data: recent } = await supabase
    .from("toube_sessions")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) return recent.id;
  const { data: created } = await supabase
    .from("toube_sessions")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (!created) throw new Error("Não consegui abrir uma conversa.");
  return created.id;
}

// Histórico de UMA sessão (a página carrega server-side; o painel busca aqui).
// Sem ?session → a sessão mais recente. Devolve o sessionId resolvido.
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const requested = new URL(req.url).searchParams.get("session");
  const sessionId = await activeSession(supabase, user.id, requested);
  const { data } = await supabase
    .from("toube_messages")
    .select("id, role, content")
    .eq("user_id", user.id)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(40);
  return NextResponse.json({ sessionId, messages: (data ?? []).reverse() });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let message: string;
  let sessionId: string;
  let editMessageId: string | undefined;
  let regenerate = false;
  try {
    const body = bodySchema.parse(await req.json());
    message = body.message ?? "";
    editMessageId = body.edit_message_id;
    regenerate = body.regenerate === true;
    if (!regenerate && !message) throw new Error("mensagem obrigatória");
    // Confirma que a sessão é do usuário (senão resolve a ativa).
    sessionId = await activeSession(supabase, user.id, body.session_id);
  } catch {
    return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
  }

  // Prepara a sessão conforme o modo: normal GRAVA a mensagem nova; editar TROCA o
  // texto e poda o que veio depois; regenerar APAGA a última resposta do assistente.
  let userMessageId: string | null = null;
  if (regenerate) {
    const { data: last } = await supabase
      .from("toube_messages")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last || last.role !== "assistant") {
      return NextResponse.json({ error: "Não há resposta pra regenerar." }, { status: 400 });
    }
    await supabase.from("toube_messages").delete().eq("id", last.id).eq("user_id", user.id);
  } else if (editMessageId) {
    const { data: target } = await supabase
      .from("toube_messages")
      .select("id, role, created_at")
      .eq("id", editMessageId)
      .eq("user_id", user.id)
      .eq("session_id", sessionId)
      .maybeSingle();
    if (!target || target.role !== "user") {
      return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
    }
    await supabase
      .from("toube_messages")
      .update({ content: message })
      .eq("id", target.id)
      .eq("user_id", user.id);
    // Poda tudo que veio depois — a conversa recomeça deste ponto (estilo Gemini).
    await supabase
      .from("toube_messages")
      .delete()
      .eq("user_id", user.id)
      .eq("session_id", sessionId)
      .gt("created_at", target.created_at);
    userMessageId = target.id;
  } else {
    const { data: ins, error: insErr } = await supabase
      .from("toube_messages")
      .insert({ user_id: user.id, session_id: sessionId, role: "user", content: message })
      .select("id")
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    userMessageId = ins?.id ?? null;
  }

  // Auto-título no 1º recado da sessão + bump do updated_at (pra ordenar a lista).
  const { data: sess } = await supabase
    .from("toube_sessions")
    .select("title")
    .eq("id", sessionId)
    .single();
  const patch: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
  if (!sess?.title && message) patch.title = message.slice(0, 60);
  await supabase.from("toube_sessions").update(patch).eq("id", sessionId).eq("user_id", user.id);

  // Compactação: se a sessão passou do limiar, resume as mais antigas num resumo
  // rolante e só DEPOIS de salvar poda as cruas resumidas. Falha do resumo → não
  // poda nada (nunca perde mensagem por erro do modelo).
  let sessionSummary: string | null = null;
  {
    const { data: sRow } = await supabase
      .from("toube_sessions")
      .select("summary")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();
    sessionSummary = sRow?.summary ?? null;

    const { count: rawCount } = await supabase
      .from("toube_messages")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("user_id", user.id);

    if ((rawCount ?? 0) >= COMPACT_TRIGGER) {
      const dropN = (rawCount ?? 0) - HISTORY_WINDOW;
      const { data: oldest } = await supabase
        .from("toube_messages")
        .select("id, role, content")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(dropN);
      if (oldest && oldest.length > 0) {
        try {
          const newSummary = await summarizeConversation(
            sessionSummary,
            oldest.map((m) => ({ role: m.role, content: m.content })),
          );
          if (newSummary) {
            await supabase
              .from("toube_sessions")
              .update({ summary: newSummary })
              .eq("id", sessionId)
              .eq("user_id", user.id);
            await supabase
              .from("toube_messages")
              .delete()
              .in(
                "id",
                oldest.map((m) => m.id),
              )
              .eq("user_id", user.id);
            sessionSummary = newSummary;
          }
        } catch {
          // Groq fora: mantém as cruas, segue a rodada normal.
        }
      }
    }
  }

  // Histórico recente DESSA SESSÃO (o modelo só vê a conversa atual — anti-alucinação).
  const { data: rows } = await supabase
    .from("toube_messages")
    .select("role, content")
    .eq("user_id", user.id)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_WINDOW);
  const history = ((rows ?? []) as ChatMessage[]).reverse();

  // O resumo rolante entra como contexto de sistema ANTES da janela viva, então o
  // modelo mantém o fio mesmo depois da poda. ChatMessage já aceita role "system"
  // e toubeReply faz [{system}, ...history], então isto vira um 2º system.
  const historyForModel: ChatMessage[] = sessionSummary
    ? [{ role: "system", content: `[Resumo da conversa até aqui]\n${sessionSummary}` }, ...history]
    : history;

  // Metas + tarefas ativas da pessoa — o Toube usa pra orientar E pra editar/concluir/
  // deletar (por isso mando o id de cada uma). Vão junto ao modelo (Z.ai); limitado e
  // com descrição truncada pra segurar tokens e dado enviado.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const agora = new Date().toLocaleTimeString("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  const [{ data: goals }, { data: tasks }, { data: cats }, { data: exercises }] = await Promise.all(
    [
      supabase
        .from("goals")
        .select("id, title, description, target_date")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("sort_order")
        .limit(20),
      supabase
        .from("tasks")
        .select("id, title, due_date")
        .eq("user_id", user.id)
        .eq("done", false)
        .order("created_at")
        .limit(30),
      supabase
        .from("finance_categories")
        .select("id, name, kind")
        .eq("user_id", user.id)
        .eq("archived", false)
        .limit(40),
      supabase.from("exercises").select("id, name, muscle_group").eq("user_id", user.id).limit(60),
    ],
  );
  const metasBlock =
    goals && goals.length > 0
      ? `METAS ATIVAS (use o id pra editar/concluir/deletar):\n${goals
          .map((g) => {
            const prazo = g.target_date ? ` (prazo: ${g.target_date})` : "";
            const desc = g.description ? ` — ${g.description.slice(0, 160)}` : "";
            return `- [id ${g.id}] "${g.title}"${prazo}${desc}`;
          })
          .join("\n")}`
      : "A pessoa ainda não tem metas ativas.";
  const tasksBlock =
    tasks && tasks.length > 0
      ? `\n\nTAREFAS ABERTAS (use o id pra concluir/deletar):\n${tasks
          .map((t) => `- [id ${t.id}] "${t.title}"${t.due_date ? ` (até ${t.due_date})` : ""}`)
          .join("\n")}`
      : "";
  const catsBlock =
    cats && cats.length > 0
      ? `\n\nCATEGORIAS DE FINANÇAS (mande o id no lancar_transacao quando a fala casar):\n${cats
          .map((c) => `- [id ${c.id}] "${c.name}" (${c.kind === "income" ? "receita" : "gasto"})`)
          .join("\n")}`
      : "";
  const exercisesBlock =
    exercises && exercises.length > 0
      ? `\n\nEXERCÍCIOS DO CATÁLOGO (use o id no logar_serie; só existe o que está aqui):\n${exercises
          .map((e) => `- [id ${e.id}] "${e.name}"${e.muscle_group ? ` (${e.muscle_group})` : ""}`)
          .join("\n")}`
      : "";
  const diaSemana = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
  });
  const metasContext = `Hoje é ${diaSemana}, ${today}, e agora são ${agora} (horário de Brasília).\n\n${metasBlock}${tasksBlock}${catsBlock}${exercisesBlock}`;

  let result: ToubeResult;
  try {
    // Consultas de leitura executam na hora com o client RLS deste usuário.
    result = await toubeReply(historyForModel, metasContext, (tool, args) =>
      executeToubeRead(supabase, user.id, tool, args),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao falar com o Toube." },
      { status: 502 },
    );
  }

  // logar_serie: o modelo às vezes casa o exercício ERRADO (chumba um id do catálogo
  // pra algo que a pessoa nem citou). O id é a fonte da verdade — reescrevo o nome
  // exibido com o nome REAL do id pra confirmação ser honesta (a pessoa cancela se
  // não for o que quis). Se o id nem está no catálogo, marco pra barrar no execute.
  if (result.kind === "proposals" && exercises) {
    const exName = new Map(exercises.map((e) => [e.id, e.name]));
    for (const p of result.proposals) {
      if (p.action !== "logar_serie") continue;
      const real = exName.get(String(p.args.exercise_id));
      p.args.exercicio = real ?? "⚠️ exercício fora do catálogo";
      if (!real) p.args.exercise_id = "";
    }
  }

  // Grava o texto da resposta (a proposta em si é efêmera — a pessoa confirma no ato).
  const { data: saved } = await supabase
    .from("toube_messages")
    .insert({ user_id: user.id, session_id: sessionId, role: "assistant", content: result.text })
    .select("id")
    .single();

  // Os ids voltam pro cliente: sem eles não dá pra editar/regenerar o que acabou
  // de ser enviado (só as mensagens carregadas do banco tinham id).
  const ids = { user_message_id: userMessageId, assistant_message_id: saved?.id ?? null };
  return NextResponse.json(
    result.kind === "proposals"
      ? { reply: result.text, proposals: result.proposals, ...ids }
      : { reply: result.text, ...ids },
  );
}
