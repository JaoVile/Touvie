import { todayBRT, todayBRTISO, tomorrowBRTISO } from "@/lib/datetime";
import { logEvent } from "@/lib/logger";
import { CRON_FALLBACK } from "@/lib/notification-defaults";
import { renderTemplate } from "@/lib/notifications/render";
import { MORNING_VARS, buildContext } from "@/lib/notifications/variables";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/telegram";
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
  const weekday = todayBRT().getUTCDay();

  const { data: tpl } = await admin
    .from("notification_templates")
    .select("content, is_active")
    .eq("key", "cron:morning")
    .maybeSingle();

  const template =
    tpl?.is_active === false ? null : (tpl?.content ?? CRON_FALLBACK["cron:morning"]);
  if (!template) {
    return NextResponse.json({ ok: true, sent: 0, reason: "template_inactive" });
  }

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
    const ctx = buildContext(admin, p.id, today, tomorrow, weekday);
    const text = await renderTemplate(template, ctx, MORNING_VARS);
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
