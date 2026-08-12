import type { ToubeCtx } from "@/lib/toube-ctx";
import { z } from "zod";

export const reminderSchema = z.object({
  message: z.string().trim().min(1, "Mensagem obrigatória").max(200),
  at_time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida (use HH:MM)"),
  // Presente → lembrete de UMA VEZ SÓ (once) nesse dia. Ausente → diário.
  on_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use YYYY-MM-DD)")
    .optional(),
  area: z.string().max(40).optional(),
});

/**
 * Cria um lembrete: DIÁRIO ou de UMA VEZ SÓ (quando vem `on_date`). O cron
 * `reminders-sweep` varre `user_reminders` ativos e entrega pelo Telegram.
 * Retorna `warning` quando o Telegram não está conectado.
 */
export async function saveReminderCore(
  ctx: ToubeCtx,
  input: unknown,
): Promise<{ ok?: boolean; error?: string; warning?: string }> {
  const parsed = reminderSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  const once = Boolean(parsed.data.on_date);
  const { error } = await ctx.supabase.from("user_reminders").insert({
    user_id: ctx.userId,
    area: parsed.data.area ?? "toube",
    message: parsed.data.message,
    schedule_type: once ? "once" : "daily",
    at_time: parsed.data.at_time,
    on_date: parsed.data.on_date ?? null,
    active: true,
  });
  if (error) return { error: error.message };

  // Sem Telegram conectado o cron não tem pra onde entregar — avisa (não é erro).
  const { data: prof } = await ctx.supabase
    .from("profiles")
    .select("telegram_chat_id")
    .eq("id", ctx.userId)
    .maybeSingle();
  const warning = prof?.telegram_chat_id
    ? undefined
    : "Lembrete criado, mas conecte o Telegram em Config → Telegram pra ele chegar.";

  return { ok: true, warning };
}
