import { createClient } from "@/lib/supabase/server";
import { runToubeTurn } from "@/lib/toube-turn";
import { NextResponse } from "next/server";
import { z } from "zod";

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
      .eq("source", "web")
      .maybeSingle();
    if (data) return data.id;
  }
  const { data: recent } = await supabase
    .from("toube_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("source", "web")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) return recent.id;
  const { data: created } = await supabase
    .from("toube_sessions")
    .insert({ user_id: userId, source: "web" })
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
  const { data: sess } = await supabase
    .from("toube_sessions")
    .select("summary")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();
  return NextResponse.json({
    sessionId,
    messages: (data ?? []).reverse(),
    summary: sess?.summary ?? null,
  });
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

  let turn: Awaited<ReturnType<typeof runToubeTurn>>;
  try {
    turn = await runToubeTurn({ supabase, userId: user.id }, { sessionId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao falar com o Toube." },
      { status: 502 },
    );
  }

  // Os ids voltam pro cliente: sem eles não dá pra editar/regenerar o que
  // acabou de ser enviado.
  const ids = {
    user_message_id: userMessageId,
    assistant_message_id: turn.assistantMessageId,
  };
  return NextResponse.json(
    turn.result.kind === "proposals"
      ? { reply: turn.result.text, proposals: turn.result.proposals, ...ids }
      : { reply: turn.result.text, ...ids },
  );
}
