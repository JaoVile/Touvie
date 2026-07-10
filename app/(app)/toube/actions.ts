"use server";

import { saveTransaction } from "@/app/(app)/financas/actions";
import {
  deleteGoal,
  deleteTask,
  saveGoal,
  saveTask,
  setGoalStatus,
  toggleTaskDone,
} from "@/app/(app)/metas/actions";
import { saveReminder } from "@/app/(app)/notificacoes/actions";
import { saveDailyBlock } from "@/app/(app)/rotina/actions";
import { createClient } from "@/lib/supabase/server";
import type { ToubeAction } from "@/lib/toube";

const todayBRT = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

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
      if (/^\d{4}-\d{2}-\d{2}$/.test(str(args.data))) fd.set("on_date", str(args.data));
      const res = await saveReminder(fd);
      return res?.error ? { error: res.error } : { ok: true, note: res.warning };
    }

    default:
      return { error: "Ação desconhecida." };
  }
}
