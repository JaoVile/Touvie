import { getOrCreateDraft, saveDraftPlan } from "@/app/(app)/toube/planos/actions";
import { applyMutation } from "@/lib/planos-draft";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage } from "@/lib/toube";
import { planosReply } from "@/lib/toube-planos";
import { NextResponse } from "next/server";
import { z } from "zod";

// Máx maior que o chat comum: no modo Plano a mensagem pode carregar um bloco
// [ANEXO] com texto extraído (~6k) além do que a pessoa digitou. `history` mantém
// o diálogo multi-turno (o modelo pergunta "quantos dias?" e precisa lembrar).
const bodySchema = z.object({
  message: z.string().trim().min(1).max(12000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(12000) }))
    .max(24)
    .optional(),
});

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

  let history: ChatMessage[];
  try {
    const body = bodySchema.parse(await req.json());
    history = [...(body.history ?? []), { role: "user", content: body.message }];
  } catch {
    return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
  }

  const { id, plan } = await getOrCreateDraft();

  let result: Awaited<ReturnType<typeof planosReply>>;
  try {
    result = await planosReply(history, plan);
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
