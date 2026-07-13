import { createClient } from "@/lib/supabase/server";
import { type ChatMessage, type ToubeResult, toubeReply } from "@/lib/toube";
import { executeToubeRead } from "@/lib/toube-reads";
import { NextResponse } from "next/server";
import { z } from "zod";

// Quantas mensagens do histórico mandar ao modelo (segura custo/contexto).
const HISTORY_WINDOW = 20;

const bodySchema = z.object({ message: z.string().trim().min(1).max(4000) });

// Histórico pro painel flutuante (a página /toube carrega server-side; o painel
// busca aqui na primeira abertura). Mesma auth do POST.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data } = await supabase
    .from("toube_messages")
    .select("id, role, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);
  return NextResponse.json({ messages: (data ?? []).reverse() });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let message: string;
  try {
    message = bodySchema.parse(await req.json()).message;
  } catch {
    return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
  }

  // Grava a mensagem do usuário.
  const { error: insErr } = await supabase
    .from("toube_messages")
    .insert({ user_id: user.id, role: "user", content: message });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Histórico recente (já inclui a mensagem acima) em ordem cronológica.
  const { data: rows } = await supabase
    .from("toube_messages")
    .select("role, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_WINDOW);
  const history = ((rows ?? []) as ChatMessage[]).reverse();

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
  const metasContext = `Hoje é ${today} e agora são ${agora} (horário de Brasília).\n\n${metasBlock}${tasksBlock}${catsBlock}${exercisesBlock}`;

  let result: ToubeResult;
  try {
    // Consultas de leitura executam na hora com o client RLS deste usuário.
    result = await toubeReply(history, metasContext, (tool, args) =>
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
  await supabase
    .from("toube_messages")
    .insert({ user_id: user.id, role: "assistant", content: result.text });

  return NextResponse.json(
    result.kind === "proposals"
      ? { reply: result.text, proposals: result.proposals }
      : { reply: result.text },
  );
}
