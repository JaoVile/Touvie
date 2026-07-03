"use server";

import type { ReminderSchedule } from "@/lib/reminders";
import { createClient } from "@/lib/supabase/server";
import { escapeHtml, sendMessage } from "@/lib/telegram";

/** Lembrete já persistido (id + agendamento reconstruído das colunas). */
export type ReminderRow = {
  id: string;
  area: string;
  message: string;
  schedule: ReminderSchedule;
  active: boolean;
};

/** Linha crua da tabela user_reminders (subset que lemos). */
type DbRow = {
  id: string;
  area: string;
  message: string;
  active: boolean;
  schedule_type: "daily" | "weekly" | "interval";
  at_time: string | null;
  days: number[];
  every_hours: number | null;
  window_from: string | null;
  window_to: string | null;
};

/** schedule discriminado → colunas da tabela. */
function scheduleToColumns(s: ReminderSchedule) {
  return {
    schedule_type: s.type,
    at_time: s.type === "interval" ? null : s.time,
    days: s.type === "weekly" ? s.days : [],
    every_hours: s.type === "interval" ? s.everyHours : null,
    window_from: s.type === "interval" ? s.from : null,
    window_to: s.type === "interval" ? s.to : null,
  };
}

/** linha da tabela → schedule discriminado. */
function rowToReminder(r: DbRow): ReminderRow {
  let schedule: ReminderSchedule;
  if (r.schedule_type === "weekly") {
    schedule = { type: "weekly", days: r.days ?? [], time: r.at_time ?? "08:00" };
  } else if (r.schedule_type === "interval") {
    schedule = {
      type: "interval",
      everyHours: r.every_hours ?? 2,
      from: r.window_from ?? "08:00",
      to: r.window_to ?? "20:00",
    };
  } else {
    schedule = { type: "daily", time: r.at_time ?? "08:00" };
  }
  return { id: r.id, area: r.area, message: r.message, schedule, active: r.active };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, userId: user.id };
}

/** Detecta o caso "tabela ainda não criada" pra dar instrução clara. */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST205" || !!error.message?.includes("user_reminders");
}

export async function listReminders(
  area: string,
): Promise<{ ok: boolean; reminders?: ReminderRow[]; error?: string }> {
  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from("user_reminders")
      .select(
        "id, area, message, active, schedule_type, at_time, days, every_hours, window_from, window_to",
      )
      .eq("user_id", userId)
      .eq("area", area)
      .order("created_at", { ascending: false });
    if (error) {
      return {
        ok: false,
        error: isMissingTable(error)
          ? "Tabela user_reminders ainda não existe — aplique a migration 0018 no Supabase."
          : error.message,
      };
    }
    return { ok: true, reminders: (data as DbRow[]).map(rowToReminder) };
  } catch {
    return { ok: false, error: "Sessão expirada — entre de novo." };
  }
}

export async function createReminder(input: {
  area: string;
  message: string;
  schedule: ReminderSchedule;
}): Promise<{ ok: boolean; error?: string }> {
  const message = input.message.trim();
  if (!message) return { ok: false, error: "Escreva uma mensagem." };
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase.from("user_reminders").insert({
      user_id: userId,
      area: input.area,
      message,
      active: true,
      ...scheduleToColumns(input.schedule),
    });
    if (error) {
      return {
        ok: false,
        error: isMissingTable(error)
          ? "Aplique a migration 0018 no Supabase primeiro."
          : error.message,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Não consegui salvar." };
  }
}

export async function toggleReminder(
  id: string,
  active: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("user_reminders")
      .update({ active })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Falhou." };
  }
}

export async function deleteReminder(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("user_reminders")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Falhou." };
  }
}

/**
 * Dispara AGORA, no Telegram do usuário logado, a mensagem que ele está
 * compondo — o "teste" do lembrete. Usa a MESMA engrenagem (sendMessage) que
 * o cron usará no disparo agendado, então provar isto aqui = provar o canal.
 */
export async function sendTestReminder(message: string): Promise<{ ok: boolean; error?: string }> {
  const text = message.trim();
  if (!text) return { ok: false, error: "Escreva uma mensagem primeiro." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada — entre de novo." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("telegram_chat_id")
    .eq("id", user.id)
    .maybeSingle();

  const chatId = profile?.telegram_chat_id;
  if (!chatId) {
    return { ok: false, error: "Conecte seu Telegram em Config → Telegram primeiro." };
  }

  try {
    await sendMessage(chatId, `🔔 <b>${escapeHtml(text)}</b>\n\n<i>Teste de lembrete · Touvie</i>`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Não consegui enviar. Confira a conexão do Telegram." };
  }
}
