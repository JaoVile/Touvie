import { saveMeasurementCore } from "@/app/(app)/dieta/core";
import { saveTransactionCore } from "@/app/(app)/financas/core";
import {
  deleteGoalCore,
  deleteTaskCore,
  getGoalCore,
  saveGoalCore,
  saveTaskCore,
  setGoalStatusCore,
  toggleTaskDoneCore,
} from "@/app/(app)/metas/core";
import { createQuickNoteCore } from "@/app/(app)/notas/core";
import { saveReminderCore } from "@/app/(app)/notificacoes/core";
import { saveDailyBlockCore } from "@/app/(app)/rotina/core";
import { logQuickSetCore } from "@/app/(app)/treino/core";
import type { ToubeAction } from "@/lib/toube";
import type { ToubeCtx } from "@/lib/toube-ctx";

const todayBRT = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

// Próxima ocorrência de um HH:MM em BRT: hoje se ainda não passou, senão amanhã.
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
const numOrNull = (v: unknown) => {
  if (v == null || v === "") return null;
  const n = Number.parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Executa uma ação que o Toube PROPÔS, depois que a pessoa confirmou. Os args
 * vêm do modelo (input NÃO confiável) — a validação zod acontece dentro de cada
 * core, que também filtra `user_id`. O Diário NÃO tem ação aqui.
 */
export async function executeToube(
  ctx: ToubeCtx,
  action: ToubeAction,
  args: Record<string, unknown>,
): Promise<{ error?: string; ok?: boolean; note?: string }> {
  const id = str(args.id);

  switch (action) {
    case "criar_meta":
      return saveGoalCore(ctx, {
        title: str(args.title),
        description: args.description != null ? str(args.description) : null,
        target_date: args.target_date != null ? str(args.target_date) : null,
      });

    case "editar_meta": {
      if (!isUuid(id)) return { error: "id inválido." };
      const cur = await getGoalCore(ctx, id);
      if (!cur) return { error: "meta não encontrada." };
      return saveGoalCore(ctx, {
        id,
        title: str(args.title ?? cur.title),
        description: (args.description ?? cur.description) as string | null,
        target_date: (args.target_date ?? cur.target_date) as string | null,
      });
    }

    case "concluir_meta":
      if (!isUuid(id)) return { error: "id inválido." };
      return setGoalStatusCore(ctx, id, "done");

    case "deletar_meta":
      if (!isUuid(id)) return { error: "id inválido." };
      return deleteGoalCore(ctx, id);

    case "criar_tarefa":
      return saveTaskCore(ctx, {
        title: str(args.title),
        due_date: args.due_date != null ? str(args.due_date) : null,
      });

    case "concluir_tarefa":
      if (!isUuid(id)) return { error: "id inválido." };
      return toggleTaskDoneCore(ctx, id, true);

    case "deletar_tarefa":
      if (!isUuid(id)) return { error: "id inválido." };
      return deleteTaskCore(ctx, id);

    case "lancar_transacao":
      return saveTransactionCore(ctx, {
        kind: str(args.kind) === "income" ? "income" : "expense",
        amount: numOrNull(args.valor) ?? 0,
        occurred_on: str(args.data) || todayBRT(),
        description: args.descricao != null ? str(args.descricao) : null,
        category_id: isUuid(args.category_id) ? str(args.category_id) : null,
      });

    case "adicionar_bloco_rotina":
      return saveDailyBlockCore(ctx, {
        time_slot: str(args.hora),
        title: str(args.titulo),
      });

    case "criar_lembrete": {
      // Só vira diário com recorrência EXPLÍCITA; senão é uma vez — na data dita
      // ou na próxima ocorrência do horário (hoje/amanhã, calculado em BRT). O
      // modelo não sabe a hora atual e às vezes manda data=hoje pra horário que
      // JÁ passou (viraria lembrete morto), então só data FUTURA é aceita.
      let on_date: string | undefined;
      if (args.recorrente !== true) {
        const given = /^\d{4}-\d{2}-\d{2}$/.test(str(args.data)) ? str(args.data) : "";
        on_date = given > todayBRT() ? given : nextOccurrenceBRT(str(args.hora));
      }
      const res = await saveReminderCore(ctx, {
        at_time: str(args.hora),
        message: str(args.mensagem),
        on_date,
      });
      return res.error ? { error: res.error } : { ok: true, note: res.warning };
    }

    case "criar_nota":
      return createQuickNoteCore(ctx, {
        title: str(args.titulo),
        content: args.corpo != null ? str(args.corpo) : "",
      });

    case "registrar_medida":
      return saveMeasurementCore(ctx, {
        measured_on: str(args.data) || todayBRT(),
        weight_kg: numOrNull(args.peso),
        waist_cm: numOrNull(args.cintura_cm),
        chest_cm: null,
        arm_cm: null,
        thigh_cm: null,
        bodyfat_pct: numOrNull(args.gordura_pct),
        notes: null,
      });

    case "logar_serie":
      if (!isUuid(args.exercise_id)) {
        return { error: "exercício inválido (não está no catálogo)." };
      }
      return logQuickSetCore(ctx, {
        exercise_id: str(args.exercise_id),
        reps: str(args.reps),
        weight_kg: str(args.carga),
        rpe: args.rpe != null ? str(args.rpe) : undefined,
      });

    default:
      return { error: "Ação desconhecida." };
  }
}
