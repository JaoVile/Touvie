import { todayBRT } from "@/lib/datetime";
import { logEvent } from "@/lib/logger";
import { TRAINING_FALLBACK } from "@/lib/notification-defaults";
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

const WEEKDAY_KEYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const weekday = todayBRT().getUTCDay();
  const admin = createAdminClient();

  const { data: tpl } = await admin
    .from("notification_templates")
    .select("content, is_active")
    .eq("key", `training:${WEEKDAY_KEYS[weekday]}`)
    .maybeSingle();

  const text = tpl?.is_active ? tpl.content : (TRAINING_FALLBACK[weekday] ?? null);
  if (!text) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_workout_for_weekday" });
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, telegram_chat_id")
    .not("telegram_chat_id", "is", null);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_subscribers" });
  }

  let sent = 0;
  for (const p of profiles) {
    if (!p.telegram_chat_id) continue;
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
    source: "cron/training-reminder",
    status: sent > 0 ? "success" : "warning",
    messagePreview: text,
    metadata: { sent, weekday, profiles: profiles.length },
  });

  return NextResponse.json({ ok: true, sent, weekday });
}
