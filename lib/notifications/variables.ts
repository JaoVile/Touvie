// Renderers das variáveis dos templates de cron.
// Cada função devolve um bloco pronto (header + corpo, com HTML do
// Telegram) ou string vazia se não houver dado — assim o template pode
// posicionar a variável e o renderer some sozinho quando não tem o que
// dizer.

import { addDaysISO } from "@/lib/datetime";
import { parseRecurrenceRule } from "@/lib/finance";
import { escapeHtml } from "@/lib/telegram";
import { formatBRL } from "@/lib/utils";
import type { CronVarMap, VarContext } from "./render";

const WEEKDAY_NAMES = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function dateLabel(iso: string): string {
  // "YYYY-MM-DD" → "DD de Mês"
  const [, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
  return `${String(d).padStart(2, "0")} de ${MONTH_NAMES[m - 1]?.toLowerCase()}`;
}

// ─── MORNING ─────────────────────────────────────────────────────────

export const MORNING_VARS: CronVarMap = {
  greeting: async ({ weekday }) => `☀️ <b>Bom dia!</b> Hoje é ${WEEKDAY_NAMES[weekday]}.`,

  weekday: async ({ weekday }) => WEEKDAY_NAMES[weekday],

  date: async ({ today }) => dateLabel(today),

  daily_routine: async ({ admin, userId }) => {
    const { data } = await admin
      .from("routine_daily")
      .select("time_slot, title, emoji")
      .eq("user_id", userId)
      .eq("active", true)
      .order("time_slot");
    if (!data || data.length === 0) return "";
    const lines = ["📅 <b>Rotina do dia</b>"];
    for (const r of data.slice(0, 12)) {
      const time = r.time_slot.slice(0, 5);
      const emoji = r.emoji ? `${r.emoji} ` : "";
      lines.push(`• <code>${time}</code> ${emoji}${escapeHtml(r.title)}`);
    }
    return lines.join("\n");
  },

  weekly_blocks: async ({ admin, userId, weekday }) => {
    const { data } = await admin
      .from("routine_weekly")
      .select("block, title, emoji")
      .eq("user_id", userId)
      .eq("weekday", weekday)
      .order("block");
    if (!data || data.length === 0) return "";
    const lines = ["📌 <b>Blocos de hoje</b>"];
    for (const w of data) {
      const emoji = w.emoji ? `${w.emoji} ` : "";
      lines.push(`• ${emoji}${escapeHtml(w.title)} <i>(${escapeHtml(w.block)})</i>`);
    }
    return lines.join("\n");
  },

  pending_tasks: async ({ admin, userId, today }) => {
    const { data } = await admin
      .from("tasks")
      .select("title, due_date")
      .eq("user_id", userId)
      .eq("done", false)
      .lte("due_date", today)
      .order("due_date");
    if (!data || data.length === 0) return "";
    const lines = [`✅ <b>Tarefas pendentes</b> (${data.length})`];
    for (const t of data.slice(0, 8)) {
      const due = t.due_date && t.due_date < today ? ` <i>(venceu ${t.due_date})</i>` : "";
      lines.push(`• ${escapeHtml(t.title)}${due}`);
    }
    if (data.length > 8) lines.push(`<i>… +${data.length - 8} no app</i>`);
    return lines.join("\n");
  },

  bills_today: async ({ admin, userId, today }) => {
    const { data } = await admin
      .from("bills")
      .select("title, amount_cents")
      .eq("user_id", userId)
      .is("paid_at", null)
      .eq("due_date", today)
      .order("amount_cents", { ascending: false });
    if (!data || data.length === 0) return "";
    const lines = ["🔔 <b>Contas vencendo hoje</b>"];
    for (const b of data) {
      lines.push(`• ${escapeHtml(b.title)} — <code>${formatBRL(b.amount_cents)}</code>`);
    }
    return lines.join("\n");
  },

  pinned_notes: async ({ admin, userId }) => {
    const { data } = await admin
      .from("notes")
      .select("title")
      .eq("user_id", userId)
      .eq("pinned", true)
      .order("updated_at", { ascending: false })
      .limit(5);
    if (!data || data.length === 0) return "";
    const lines = ["📎 <b>Notas fixadas</b>"];
    for (const n of data) {
      const title = n.title?.trim() || "(sem título)";
      lines.push(`• ${escapeHtml(title)}`);
    }
    return lines.join("\n");
  },
};

// ─── EVENING ─────────────────────────────────────────────────────────

export const EVENING_VARS: CronVarMap = {
  greeting: async () => "🌙 <b>Boa noite!</b>",

  weekday: async ({ weekday }) => WEEKDAY_NAMES[weekday],

  tomorrow_recurrences: async ({ admin, userId, tomorrow }) => {
    const tomorrowDay = Number.parseInt(tomorrow.slice(8, 10), 10);
    const { data } = await admin
      .from("transactions")
      .select("amount_cents, kind, description, recurrence_rule, reminder_enabled")
      .eq("user_id", userId)
      .eq("is_recurring", true)
      .eq("reminder_enabled", true);
    const filtered = (data ?? []).filter((r) => {
      const rule = parseRecurrenceRule(r.recurrence_rule);
      return rule?.day === tomorrowDay;
    });
    if (filtered.length === 0) return "";
    const lines = ["📌 <b>Recorrências de amanhã</b>"];
    for (const r of filtered) {
      const sign = r.kind === "income" ? "+" : "−";
      const desc = r.description
        ? escapeHtml(r.description)
        : r.kind === "income"
          ? "Receita"
          : "Despesa";
      lines.push(`• ${desc} — <code>${sign} ${formatBRL(r.amount_cents)}</code>`);
    }
    return lines.join("\n");
  },

  upcoming_bills_3d: async ({ admin, userId, today, tomorrow }) => {
    const in3 = addDaysISO(today, 3);
    const { data } = await admin
      .from("bills")
      .select("title, amount_cents, due_date")
      .eq("user_id", userId)
      .is("paid_at", null)
      .gte("due_date", tomorrow)
      .lte("due_date", in3)
      .order("due_date");
    if (!data || data.length === 0) return "";
    const lines = ["🔔 <b>Contas a vencer (próximos 3 dias)</b>"];
    for (const b of data) {
      const days = Math.round(
        (new Date(b.due_date).getTime() - new Date(today).getTime()) / 86400000,
      );
      const when = days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`;
      lines.push(`• ${escapeHtml(b.title)} — <code>${formatBRL(b.amount_cents)}</code> (${when})`);
    }
    return lines.join("\n");
  },

  tasks_due_tomorrow: async ({ admin, userId, tomorrow }) => {
    const { data } = await admin
      .from("tasks")
      .select("title, due_date")
      .eq("user_id", userId)
      .eq("done", false)
      .lte("due_date", tomorrow)
      .order("due_date");
    if (!data || data.length === 0) return "";
    const lines = ["📝 <b>Tarefas pra resolver</b> (até amanhã)"];
    for (const t of data.slice(0, 8)) {
      const due = t.due_date ? ` <i>(${t.due_date})</i>` : "";
      lines.push(`• ${escapeHtml(t.title)}${due}`);
    }
    if (data.length > 8) lines.push(`<i>… +${data.length - 8} no app</i>`);
    return lines.join("\n");
  },

  weekly_recap: async ({ admin, userId, today, weekday }) => {
    if (weekday !== 0) return ""; // só domingo
    const weekAgo = addDaysISO(today, -7);
    const [completionsRes, activeRes] = await Promise.all([
      admin
        .from("routine_completions")
        .select("routine_id")
        .eq("user_id", userId)
        .gte("completed_on", weekAgo)
        .lte("completed_on", today),
      admin.from("routine_daily").select("id").eq("user_id", userId).eq("active", true),
    ]);
    const habitCount = activeRes.data?.length ?? 0;
    if (habitCount === 0) return "";
    const completionCount = completionsRes.data?.length ?? 0;
    const maxPossible = habitCount * 7;
    const score = Math.min(100, Math.round((completionCount / maxPossible) * 100));
    const medal = score >= 80 ? "🥇" : score >= 50 ? "🥈" : "🥉";
    return `${medal} <b>Recap da semana</b>\n• Hábitos: <code>${completionCount}/${maxPossible}</code> — <b>${score}%</b> de consistência`;
  },

  sunday_scripting: async ({ weekday }) =>
    weekday === 0
      ? "🔒 <b>Domingo é dia de scripting.</b> Abra o diário e escreva como se já tivesse acontecido."
      : "",
};

// ─── MONTHLY FINANCE ─────────────────────────────────────────────────

export const MONTHLY_VARS: CronVarMap = {
  month_label: async ({ today }) => {
    const [y, m] = today.split("-").map((s) => Number.parseInt(s, 10));
    return `${MONTH_NAMES[m - 1]} ${y}`;
  },

  month_summary: async ({ admin, userId, today }) => {
    const monthStart = `${today.slice(0, 7)}-01`;
    const { data } = await admin
      .from("transactions")
      .select("amount_cents, kind")
      .eq("user_id", userId)
      .eq("is_recurring", false)
      .gte("occurred_on", monthStart)
      .lte("occurred_on", today);
    const txs = data ?? [];
    if (txs.length === 0) return "💤 Nenhum lançamento registrado neste mês.";
    let income = 0;
    let expense = 0;
    for (const t of txs) {
      if (t.kind === "income") income += t.amount_cents;
      else expense += t.amount_cents;
    }
    const net = income - expense;
    return [
      "💰 <b>Fluxo do mês</b>",
      `• Receitas: <code>${formatBRL(income)}</code>`,
      `• Despesas: <code>${formatBRL(expense)}</code>`,
      `• Saldo: <code>${formatBRL(net)}</code> ${net >= 0 ? "✅" : "⚠️"}`,
    ].join("\n");
  },

  tx_count: async ({ admin, userId, today }) => {
    const monthStart = `${today.slice(0, 7)}-01`;
    const { count } = await admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_recurring", false)
      .gte("occurred_on", monthStart)
      .lte("occurred_on", today);
    const n = count ?? 0;
    if (n === 0) return "";
    return `📊 <b>${n}</b> lançamento${n === 1 ? "" : "s"} no mês.`;
  },

  top_expense_categories: async ({ admin, userId, today }) => {
    const monthStart = `${today.slice(0, 7)}-01`;
    // Duas queries em paralelo (transactions + categories) e join em JS
    // — evita inferência ruim do supabase-js em embedded selects.
    const [txRes, catRes] = await Promise.all([
      admin
        .from("transactions")
        .select("amount_cents, category_id")
        .eq("user_id", userId)
        .eq("kind", "expense")
        .eq("is_recurring", false)
        .gte("occurred_on", monthStart)
        .lte("occurred_on", today),
      admin.from("finance_categories").select("id, name, emoji").eq("user_id", userId),
    ]);
    const txs = txRes.data ?? [];
    if (txs.length === 0) return "";
    const catMap = new Map<string, { name: string; emoji: string | null }>();
    for (const c of catRes.data ?? []) {
      catMap.set(c.id, { name: c.name, emoji: c.emoji });
    }
    const byCat = new Map<string, { sum: number; name: string; emoji: string | null }>();
    for (const t of txs) {
      const cat = t.category_id ? catMap.get(t.category_id) : null;
      const name = cat?.name ?? "Sem categoria";
      const emoji = cat?.emoji ?? null;
      const prev = byCat.get(name) ?? { sum: 0, name, emoji };
      prev.sum += t.amount_cents;
      byCat.set(name, prev);
    }
    const top = Array.from(byCat.values())
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 3);
    if (top.length === 0) return "";
    const lines = ["🏷️ <b>Top categorias</b>"];
    for (const c of top) {
      const emoji = c.emoji ? `${c.emoji} ` : "";
      lines.push(`• ${emoji}${escapeHtml(c.name)} — <code>${formatBRL(c.sum)}</code>`);
    }
    return lines.join("\n");
  },
};

export const CRON_VAR_MAPS: Record<string, CronVarMap> = {
  "cron:morning": MORNING_VARS,
  "cron:evening": EVENING_VARS,
  "cron:monthly-finance": MONTHLY_VARS,
};

export function buildContext(
  admin: VarContext["admin"],
  userId: string,
  today: string,
  tomorrow: string,
  weekday: number,
): VarContext {
  return { admin, userId, today, tomorrow, weekday };
}
