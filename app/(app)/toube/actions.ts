"use server";

import { saveGoal, saveTask } from "@/app/(app)/metas/actions";
import type { ToubeAction } from "@/lib/toube";

/**
 * Executa uma ação que o Toube PROPÔS, DEPOIS que a pessoa confirmou no chat.
 * Os args vêm do modelo (input NÃO confiável) — a validação (zod), auth e RLS
 * acontecem dentro das server actions do módulo (saveGoal/saveTask, que já usam
 * requireUser). Aqui a gente só mapeia a ação e delega; nada é escrito sem passar
 * por essa validação nem sem a pessoa ter confirmado.
 */
export async function executeToubeAction(
  action: ToubeAction,
  args: Record<string, unknown>,
): Promise<{ error?: string; ok?: boolean }> {
  const str = (v: unknown) => (v == null ? "" : String(v));

  if (action === "criar_meta") {
    const fd = new FormData();
    fd.set("title", str(args.title));
    if (args.description) fd.set("description", str(args.description));
    if (args.target_date) fd.set("target_date", str(args.target_date));
    const res = await saveGoal(fd);
    return res?.error ? { error: res.error } : { ok: true };
  }

  if (action === "criar_tarefa") {
    const fd = new FormData();
    fd.set("title", str(args.title));
    if (args.due_date) fd.set("due_date", str(args.due_date));
    const res = await saveTask(fd);
    return res?.error ? { error: res.error } : { ok: true };
  }

  return { error: "Ação desconhecida." };
}
