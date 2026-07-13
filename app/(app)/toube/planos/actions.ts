"use server";

import { EMPTY_PLAN, type Plan } from "@/lib/planos-draft";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, userId: user.id };
}

export async function getOrCreateDraft(): Promise<{ id: string; plan: Plan }> {
  const { supabase, userId } = await requireUser();
  const { data: existing } = await supabase
    .from("workout_program_drafts")
    .select("id, plan")
    .eq("user_id", userId)
    .eq("status", "building")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { id: existing.id, plan: (existing.plan as Plan) ?? EMPTY_PLAN };

  const { data: created, error } = await supabase
    .from("workout_program_drafts")
    .insert({ user_id: userId, plan: EMPTY_PLAN })
    .select("id, plan")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Erro ao criar rascunho");
  return { id: created.id, plan: created.plan as Plan };
}

export async function saveDraftPlan(id: string, plan: Plan): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("workout_program_drafts")
    .update({ plan, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
}

export async function novoRascunho(): Promise<{ id: string }> {
  const { supabase, userId } = await requireUser();
  // Descarta rascunhos em aberto (nunca viraram programa) pra abrir um novo limpo.
  await supabase
    .from("workout_program_drafts")
    .delete()
    .eq("user_id", userId)
    .eq("status", "building");
  const { data, error } = await supabase
    .from("workout_program_drafts")
    .insert({ user_id: userId, plan: EMPTY_PLAN })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Erro ao criar rascunho");
  revalidatePath("/toube/planos");
  return { id: data.id };
}

export async function criarProgramaCompleto(): Promise<{
  ok?: boolean;
  error?: string;
  programId?: string;
}> {
  const { supabase, userId } = await requireUser();
  const { data: draft } = await supabase
    .from("workout_program_drafts")
    .select("id, plan")
    .eq("user_id", userId)
    .eq("status", "building")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!draft) return { error: "Nenhum rascunho em aberto." };
  const plan = draft.plan as Plan;
  if (!plan?.days?.length) return { error: "O plano está vazio — monta pelo menos um dia." };

  // 1) Programa
  const { data: program, error: pErr } = await supabase
    .from("workout_programs")
    .insert({ user_id: userId, name: plan.name || "Meu treino" })
    .select("id")
    .single();
  if (pErr || !program) return { error: pErr?.message ?? "Falha ao criar o programa." };

  // Rollback helper: apaga o programa (cascade derruba dias/junctions).
  const rollback = async (msg: string) => {
    await supabase.from("workout_programs").delete().eq("id", program.id);
    return { error: msg };
  };

  // Catálogo atual do usuário pra achar-ou-criar exercício por nome (case-insensitive).
  const { data: catalog, error: catErr } = await supabase
    .from("exercises")
    .select("id, name")
    .eq("user_id", userId);
  if (catErr) return rollback("Não consegui ler seu catálogo de exercícios. Tenta de novo.");
  const byName = new Map((catalog ?? []).map((e) => [e.name.trim().toLowerCase(), e.id]));

  async function ensureExercise(
    name: string,
    muscle: string | null | undefined,
  ): Promise<string | null> {
    const key = name.trim().toLowerCase();
    const found = byName.get(key);
    if (found) return found;
    const { data: ex, error } = await supabase
      .from("exercises")
      .insert({ user_id: userId, name: name.trim(), muscle_group: muscle ?? null, notes: null })
      .select("id")
      .single();
    if (error || !ex) return null;
    byName.set(key, ex.id);
    return ex.id;
  }

  // 2) Dias + 3) exercícios + junctions
  for (const day of plan.days) {
    const { data: wd, error: dErr } = await supabase
      .from("workout_days")
      .insert({ user_id: userId, program_id: program.id, weekday: day.weekday, name: day.name })
      .select("id")
      .single();
    if (dErr || !wd) return rollback(dErr?.message ?? "Falha ao criar um dia.");

    let sort = 0;
    for (const ex of day.exercises) {
      const exId = await ensureExercise(ex.name, ex.muscle_group);
      if (!exId) return rollback(`Falha no exercício "${ex.name}".`);
      const { error: jErr } = await supabase.from("workout_day_exercises").insert({
        user_id: userId,
        program_day_id: wd.id,
        exercise_id: exId,
        sort_order: sort++,
        target_sets: ex.target_sets ?? null,
        target_reps_low: ex.reps_low ?? null,
        target_reps_high: ex.reps_high ?? null,
        notes: ex.notes ?? null,
      });
      if (jErr) return rollback(jErr.message);
    }
  }

  // 4) Fecha o rascunho
  const { error: closeErr } = await supabase
    .from("workout_program_drafts")
    .update({ status: "committed", created_program_id: program.id })
    .eq("id", draft.id);
  if (closeErr) {
    // rollback já desfez o programa — não dá pra dizer que foi criado. Mensagem honesta.
    return rollback("Não consegui finalizar o programa agora. Tenta de novo.");
  }

  revalidatePath("/treino");
  revalidatePath("/toube/planos");
  return { ok: true, programId: program.id };
}
