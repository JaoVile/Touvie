"use server";

import { saveMeasurement } from "@/app/(app)/dieta/actions";
import { saveTransaction } from "@/app/(app)/financas/actions";
import {
  deleteGoal,
  deleteTask,
  saveGoal,
  saveTask,
  setGoalStatus,
  toggleTaskDone,
} from "@/app/(app)/metas/actions";
import { createQuickNote } from "@/app/(app)/notas/actions";
import { saveReminder } from "@/app/(app)/notificacoes/actions";
import { saveDailyBlock } from "@/app/(app)/rotina/actions";
import { logQuickSet } from "@/app/(app)/treino/actions";
import { createClient } from "@/lib/supabase/server";
import type { ToubeAction } from "@/lib/toube";

const todayBRT = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

// Próxima ocorrência de um HH:MM em BRT: hoje se ainda não passou, senão amanhã.
// (Regra: lembrete sem recorrência explícita vale UMA vez, dentro de 24h.)
const nextOccurrenceBRT = (hhmm: string) => {
  const now = new Date();
  const nowHM = now.toLocaleTimeString("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (hhmm > nowHM) return todayBRT();
  return new Date(now.getTime() + 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
};

const isUuid = (v: unknown) => /^[0-9a-fA-F-]{36}$/.test(String(v ?? ""));
const str = (v: unknown) => (v == null ? "" : String(v));

/**
 * Executa uma ação que o Toube PROPÔS, DEPOIS que a pessoa confirmou no chat.
 * Os args vêm do modelo (input NÃO confiável) — a validação (zod), auth e RLS
 * acontecem nas server actions do módulo (que usam requireUser + `.eq(user_id)`
 * sob RLS). Aqui a gente valida o id, mapeia a ação e delega. Nada é escrito sem
 * confirmação nem sem passar por essa validação. O Diário NÃO tem ação aqui.
 */
export async function executeToubeAction(
  action: ToubeAction,
  args: Record<string, unknown>,
): Promise<{ error?: string; ok?: boolean; note?: string }> {
  const id = str(args.id);

  switch (action) {
    case "criar_meta": {
      const fd = new FormData();
      fd.set("title", str(args.title));
      if (args.description != null) fd.set("description", str(args.description));
      if (args.target_date != null) fd.set("target_date", str(args.target_date));
      const res = await saveGoal(fd);
      return res?.error ? { error: res.error } : { ok: true };
    }

    case "editar_meta": {
      if (!isUuid(id)) return { error: "id inválido." };
      // Busca a meta atual (RLS garante que é do usuário) pra mesclar os campos que
      // NÃO mudaram — saveGoal exige título, então não dá pra mandar parcial.
      const supabase = await createClient();
      const { data: cur } = await supabase
        .from("goals")
        .select("title, description, target_date")
        .eq("id", id)
        .single();
      if (!cur) return { error: "meta não encontrada." };
      const fd = new FormData();
      fd.set("id", id);
      fd.set("title", str(args.title ?? cur.title));
      const description = args.description ?? cur.description;
      if (description != null) fd.set("description", str(description));
      const target_date = args.target_date ?? cur.target_date;
      if (target_date != null) fd.set("target_date", str(target_date));
      const res = await saveGoal(fd);
      return res?.error ? { error: res.error } : { ok: true };
    }

    case "concluir_meta":
      if (!isUuid(id)) return { error: "id inválido." };
      await setGoalStatus(id, "done");
      return { ok: true };

    case "deletar_meta":
      if (!isUuid(id)) return { error: "id inválido." };
      await deleteGoal(id);
      return { ok: true };

    case "criar_tarefa": {
      const fd = new FormData();
      fd.set("title", str(args.title));
      if (args.due_date != null) fd.set("due_date", str(args.due_date));
      const res = await saveTask(fd);
      return res?.error ? { error: res.error } : { ok: true };
    }

    case "concluir_tarefa":
      if (!isUuid(id)) return { error: "id inválido." };
      await toggleTaskDone(id, true);
      return { ok: true };

    case "deletar_tarefa":
      if (!isUuid(id)) return { error: "id inválido." };
      await deleteTask(id);
      return { ok: true };

    case "lancar_transacao": {
      const fd = new FormData();
      fd.set("kind", str(args.kind) === "income" ? "income" : "expense");
      fd.set("amount", str(args.valor));
      fd.set("occurred_on", str(args.data) || todayBRT());
      if (args.descricao != null) fd.set("description", str(args.descricao));
      if (isUuid(args.category_id)) fd.set("category_id", str(args.category_id));
      const res = await saveTransaction(fd);
      return res?.error ? { error: res.error } : { ok: true };
    }

    case "adicionar_bloco_rotina": {
      const fd = new FormData();
      fd.set("time_slot", str(args.hora));
      fd.set("title", str(args.titulo));
      const res = await saveDailyBlock(fd);
      return res?.error ? { error: res.error } : { ok: true };
    }

    case "criar_lembrete": {
      const fd = new FormData();
      fd.set("at_time", str(args.hora));
      fd.set("message", str(args.mensagem));
      // Só vira diário com recorrência EXPLÍCITA; senão é uma vez — na data dita
      // ou na próxima ocorrência do horário (hoje/amanhã, calculado aqui em BRT).
      if (args.recorrente !== true) {
        // O modelo não sabe a hora atual e às vezes manda data=hoje pra horário
        // que JÁ passou (viraria lembrete morto). Só aceitamos data FUTURA; hoje
        // ou passado recalcula pra próxima ocorrência (hoje se dá tempo, senão amanhã).
        const given = /^\d{4}-\d{2}-\d{2}$/.test(str(args.data)) ? str(args.data) : "";
        fd.set("on_date", given > todayBRT() ? given : nextOccurrenceBRT(str(args.hora)));
      }
      const res = await saveReminder(fd);
      return res?.error ? { error: res.error } : { ok: true, note: res.warning };
    }

    case "criar_nota": {
      const fd = new FormData();
      fd.set("title", str(args.titulo));
      if (args.corpo != null) fd.set("content", str(args.corpo));
      const res = await createQuickNote(fd);
      return res?.error ? { error: res.error } : { ok: true };
    }

    case "registrar_medida": {
      const fd = new FormData();
      fd.set("measured_on", str(args.data) || todayBRT());
      if (args.peso != null) fd.set("weight_kg", str(args.peso));
      if (args.cintura_cm != null) fd.set("waist_cm", str(args.cintura_cm));
      if (args.gordura_pct != null) fd.set("bodyfat_pct", str(args.gordura_pct));
      const res = await saveMeasurement(fd);
      return res?.error ? { error: res.error } : { ok: true };
    }

    case "logar_serie": {
      if (!isUuid(args.exercise_id)) return { error: "exercício inválido (não está no catálogo)." };
      const res = await logQuickSet({
        exercise_id: str(args.exercise_id),
        reps: str(args.reps),
        weight_kg: str(args.carga),
        rpe: args.rpe != null ? str(args.rpe) : undefined,
      });
      return res?.error ? { error: res.error } : { ok: true };
    }

    default:
      return { error: "Ação desconhecida." };
  }
}
