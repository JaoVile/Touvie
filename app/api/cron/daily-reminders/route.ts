import { todayBRT, todayBRTISO } from "@/lib/datetime";
import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, sendMessage } from "@/lib/telegram";
import { NextResponse } from "next/server";

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${expected}`) return true;
  // Permite header customizado pra teste manual via curl
  if (req.headers.get("x-cron-secret") === expected) return true;
  return false;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const today = todayBRTISO();
  const weekday = todayBRT().getUTCDay(); // 0=dom .. 6=sáb

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
    const text = await buildMorningMessage(admin, p.id, today, weekday);
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
    source: "cron/daily-reminders",
    status: sent > 0 ? "success" : "warning",
    messagePreview: firstText,
    metadata: { sent, profiles: profiles.length },
  });

  return NextResponse.json({ ok: true, sent });
}

async function buildMorningMessage(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  today: string,
  weekday: number,
): Promise<string | null> {
  const [dailyRes, weeklyRes, tasksRes] = await Promise.all([
    admin
      .from("routine_daily")
      .select("time_slot, title, emoji")
      .eq("user_id", userId)
      .eq("active", true)
      .order("time_slot"),
    admin
      .from("routine_weekly")
      .select("block, title, emoji")
      .eq("user_id", userId)
      .eq("weekday", weekday)
      .order("block"),
    admin
      .from("tasks")
      .select("title, due_date")
      .eq("user_id", userId)
      .eq("done", false)
      .lte("due_date", today)
      .order("due_date"),
  ]);

  const daily = dailyRes.data ?? [];
  const weekly = weeklyRes.data ?? [];
  const overdue = tasksRes.data ?? [];

  const lines: string[] = [];
  const weekdayName = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][
    weekday
  ];
  lines.push(`☀️ <b>Bom dia!</b> Hoje é ${weekdayName}.`);

  if (daily.length > 0) {
    lines.push("");
    lines.push("📅 <b>Rotina do dia</b>");
    for (const r of daily.slice(0, 12)) {
      const time = r.time_slot.slice(0, 5);
      const emoji = r.emoji ? `${r.emoji} ` : "";
      lines.push(`• <code>${time}</code> ${emoji}${escapeHtml(r.title)}`);
    }
  }

  if (weekly.length > 0) {
    lines.push("");
    lines.push("📌 <b>Blocos de hoje</b>");
    for (const w of weekly) {
      const emoji = w.emoji ? `${w.emoji} ` : "";
      lines.push(`• ${emoji}${escapeHtml(w.title)} <i>(${escapeHtml(w.block)})</i>`);
    }
  }

  if (overdue.length > 0) {
    lines.push("");
    lines.push(`✅ <b>Tarefas pendentes</b> (${overdue.length})`);
    for (const t of overdue.slice(0, 8)) {
      const due = t.due_date && t.due_date < today ? ` <i>(venceu ${t.due_date})</i>` : "";
      lines.push(`• ${escapeHtml(t.title)}${due}`);
    }
    if (overdue.length > 8) lines.push(`<i>… +${overdue.length - 8} no app</i>`);
  }

  if (daily.length === 0 && weekly.length === 0 && overdue.length === 0) {
    return null; // nada a reportar — não envia ruído
  }

  return lines.join("\n");
}
