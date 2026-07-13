import { getOrCreateDraft, saveDraftPlan } from "@/app/(app)/toube/planos/actions";
import { applyMutation } from "@/lib/planos-draft";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage } from "@/lib/toube";
import { planosReply } from "@/lib/toube-planos";
import { NextResponse } from "next/server";
import { z } from "zod";

// Máx maior que o chat comum: no modo Plano a mensagem pode carregar um bloco
// [ANEXO] com texto extraído (~6k) além do que a pessoa digitou.
const bodySchema = z.object({ message: z.string().trim().min(1).max(12000) });

// Rascunho atual — pro modo Plano do chat (toggle no ToubeConversation) hidratar.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { plan } = await getOrCreateDraft();
  return NextResponse.json({ plan });
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

  const { id, plan } = await getOrCreateDraft();

  let result: Awaited<ReturnType<typeof planosReply>>;
  try {
    result = await planosReply([{ role: "user", content: message }], plan);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao falar com o Toube Planos." },
      { status: 502 },
    );
  }

  let nextPlan = plan;
  for (const m of result.mutations) nextPlan = applyMutation(nextPlan, m.tool, m.args);
  if (result.mutations.length) await saveDraftPlan(id, nextPlan);

  return NextResponse.json({ reply: result.text, plan: nextPlan });
}
