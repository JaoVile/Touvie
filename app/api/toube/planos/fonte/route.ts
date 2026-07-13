import { getOrCreateDraft, saveDraftPlan } from "@/app/(app)/toube/planos/actions";
import { applyMutation } from "@/lib/planos-draft";
import { extractFromPdf, extractFromUrl } from "@/lib/planos-source";
import { createClient } from "@/lib/supabase/server";
import { planosReply } from "@/lib/toube-planos";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let source: { kind: string; text: string };
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const { url } = (await req.json()) as { url?: string };
      if (!url) return NextResponse.json({ error: "Sem URL." }, { status: 400 });
      source = await extractFromUrl(url);
    } else {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File))
        return NextResponse.json({ error: "Sem arquivo." }, { status: 400 });
      source = await extractFromPdf(await file.arrayBuffer());
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha na fonte." },
      { status: 422 },
    );
  }

  const { id, plan } = await getOrCreateDraft();
  let result: Awaited<ReturnType<typeof planosReply>>;
  try {
    result = await planosReply(
      [{ role: "user", content: "Monta um plano de treino com base nessa fonte." }],
      plan,
      source.text,
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro no Toube Planos." },
      { status: 502 },
    );
  }

  let nextPlan = plan;
  for (const m of result.mutations) nextPlan = applyMutation(nextPlan, m.tool, m.args);
  await saveDraftPlan(id, nextPlan);
  await supabase
    .from("workout_program_drafts")
    .update({ source_kind: source.kind })
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ reply: result.text, plan: nextPlan });
}
