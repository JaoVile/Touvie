import { createClient } from "@/lib/supabase/server";
import { type ChatMessage, toubeReply } from "@/lib/toube";
import { NextResponse } from "next/server";
import { z } from "zod";

// Quantas mensagens do histórico mandar ao modelo (segura custo/contexto).
const HISTORY_WINDOW = 20;

const bodySchema = z.object({ message: z.string().trim().min(1).max(4000) });

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

  // Metas ativas da pessoa — o Toube usa pra orientar. Vão junto ao modelo (Z.ai);
  // limitado a 20 metas e descrição truncada pra segurar tokens e dado enviado.
  const { data: goals } = await supabase
    .from("goals")
    .select("title, description, target_date")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("sort_order")
    .limit(20);
  const metasContext =
    goals && goals.length > 0
      ? `METAS ATIVAS DA PESSOA:\n${goals
          .map((g) => {
            const prazo = g.target_date ? ` (prazo: ${g.target_date})` : "";
            const desc = g.description ? ` — ${g.description.slice(0, 160)}` : "";
            return `- ${g.title}${prazo}${desc}`;
          })
          .join("\n")}`
      : "A pessoa ainda não tem metas ativas cadastradas.";

  let reply: string;
  try {
    reply = await toubeReply(history, metasContext);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao falar com o Toube." },
      { status: 502 },
    );
  }

  // Grava a resposta do assistente.
  await supabase
    .from("toube_messages")
    .insert({ user_id: user.id, role: "assistant", content: reply });

  return NextResponse.json({ reply });
}
