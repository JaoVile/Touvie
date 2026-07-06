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

  let reply: string;
  try {
    reply = await toubeReply(history);
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
