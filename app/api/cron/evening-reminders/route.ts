import { addDaysISO, todayBRT, todayBRTISO, tomorrowBRTISO } from "@/lib/datetime";
import { parseRecurrenceRule } from "@/lib/finance";
import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, sendMessage } from "@/lib/telegram";
import { formatBRL } from "@/lib/utils";
import { NextResponse } from "next/server";

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${expected}`) return true;
  if (req.headers.get("x-cron-secret") === expected) return true;
  return false;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const today = todayBRTISO();
  const tomorrow = tomorrowBRTISO();
  const tomorrowDay = Number.parseInt(tomorrow.slice(8, 10), 10);
  const weekday = todayBRT().getUTCDay();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, telegram_chat_id")
    .not("telegram_chat_id", "is", null);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_subscribers" });
  }

  let sent = 0;
  let firstText: string | undefined;
  for (const p of profiles) {
    if (!p.telegram_chat_id) continue;
    const text = await buildEveningMessage(admin, p.id, today, tomorrowDay, weekday);
    if (!text) continue;
    if (!firstText) firstText = text;
    try {
      await sendMessage(p.telegram_chat_id, text);
      sent += 1;
    } catch (err) {
      console.error(`Telegram send failed for ${p.id}:`, err);
    }
  }

  logEvent({
    userId: profiles[0]?.id ?? null,
    eventType: "cron",
    source: "cron/evening-reminders",
    status: sent > 0 ? "success" : "warning",
    messagePreview: firstText,
    metadata: { sent, profiles: profiles.length },
  });

  return NextResponse.json({ ok: true, sent });
}

async function buildEveningMessage(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  today: string,
  tomorrowDay: number,
  weekday: number,
): Promise<string | null> {
  const monthStart = `${today.slice(0, 8)}01`;

  const in3Days = addDaysISO(today, 3);
  const [txRes, recurringRes, billsRes] = await Promise.all([
    admin
      .from("transactions")
      .select("amount_cents, kind")
      .eq("user_id", userId)
      .eq("is_recurring", false)
      .gte("occurred_on", monthStart)
      .lte("occurred_on", today),
    admin
      .from("transactions")
      .select("amount_cents, kind, description, recurrence_rule, reminder_enabled")
      .eq("user_id", userId)
      .eq("is_recurring", true)
      .eq("reminder_enabled", true),
    admin
      .from("bills")
      .select("title, amount_cents, due_date")
      .eq("user_id", userId)
      .is("paid_at", null)
      .gte("due_date", today)
      .lte("due_date", in3Days)
      .order("due_date", { ascending: true }),
  ]);

  const txs = txRes.data ?? [];
  const recurring = recurringRes.data ?? [];
  const upcomingBills = billsRes.data ?? [];

  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.kind === "income") income += t.amount_cents;
    else expense += t.amount_cents;
  }
  const net = income - expense;

  const tomorrowBills = recurring.filter((r) => {
    const rule = parseRecurrenceRule(r.recurrence_rule);
    return rule?.day === tomorrowDay;
  });

  const lines: string[] = [];
  lines.push("🌙 <b>Boa noite!</b>");

  if (txs.length > 0) {
    lines.push("");
    lines.push("💰 <b>Mês corrente</b>");
    lines.push(`• Receitas: <code>${formatBRL(income)}</code>`);
    lines.push(`• Despesas: <code>${formatBRL(expense)}</code>`);
    lines.push(`• Saldo: <code>${formatBRL(net)}</code> ${net >= 0 ? "✅" : "⚠️"}`);
  }

  if (tomorrowBills.length > 0) {
    lines.push("");
    lines.push("📌 <b>Recorrências de amanhã</b>");
    for (const r of tomorrowBills) {
      const sign = r.kind === "income" ? "+" : "−";
      const desc = r.description
        ? escapeHtml(r.description)
        : r.kind === "income"
          ? "Receita"
          : "Despesa";
      lines.push(`• ${desc} — <code>${sign} ${formatBRL(r.amount_cents)}</code>`);
    }
  }

  if (upcomingBills.length > 0) {
    lines.push("");
    lines.push("🔔 <b>Contas a vencer (próximos 3 dias)</b>");
    for (const b of upcomingBills) {
      const daysUntil = Math.round((new Date(b.due_date).getTime() - new Date(today).getTime()) / 86400000);
      const when = daysUntil === 0 ? "hoje" : daysUntil === 1 ? "amanhã" : `em ${daysUntil} dias`;
      lines.push(`• ${escapeHtml(b.title)} — <code>${formatBRL(b.amount_cents)}</code> (${when})`);
    }
  }

  if (weekday === 0) {
    // Weekly habit recap
    const weekAgo = addDaysISO(today, -7);
    const { data: weekCompletions } = await admin
      .from("routine_completions")
      .select("routine_id, completed_on")
      .eq("user_id", userId)
      .gte("completed_on", weekAgo)
      .lte("completed_on", today);

    const { data: activeHabits } = await admin
      .from("routine_daily")
      .select("id")
      .eq("user_id", userId)
      .eq("active", true);

    const habitCount = activeHabits?.length ?? 0;
    const completionCount = weekCompletions?.length ?? 0;
    const maxPossible = habitCount * 7;
    const weekScore = maxPossible > 0 ? Math.min(100, Math.round((completionCount / maxPossible) * 100)) : 0;

    lines.push("");
    if (habitCount > 0) {
      const medal = weekScore >= 80 ? "🥇" : weekScore >= 50 ? "🥈" : "🥉";
      lines.push(`${medal} <b>Recap da semana</b>`);
      lines.push(`• Hábitos: <code>${completionCount}/${maxPossible}</code> — <b>${weekScore}%</b> de consistência`);
    }
    lines.push("🔒 <b>Domingo é dia de scripting.</b> Abra o diário e escreva como se já tivesse acontecido.");
  }

  // Se só tem o "Boa noite" e nada mais, não envia
  if (lines.length <= 1) return null;
  return lines.join("\n");
}
