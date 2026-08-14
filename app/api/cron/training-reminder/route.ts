import { todayBRT } from "@/lib/datetime";
import { logEvent } from "@/lib/logger";
import { TRAINING_FALLBACK } from "@/lib/notification-defaults";
import { notifyUser } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${expected}`) return true;
  if (req.headers.get("x-cron-secret") === expected) return true;
  return false;
}

const WEEKDAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

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
    // SEM `.not("telegram_chat_id", ...)`: quem usa só push também precisa
    // aparecer aqui, senão a notificação própria nunca sai.
    .select("id, notify_push, notify_telegram")
    .or("notify_push.eq.true,notify_telegram.eq.true");

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_subscribers" });
  }

  let sent = 0;
  for (const p of profiles) {
    try {
      const r = await notifyUser(admin, p.id, { text, url: "/treino" });
      // `sent` passa a contar entrega REAL (algum canal recebeu), não tentativa.
      if (r.push > 0 || r.telegram) sent += 1;
    } catch (err) {
      console.error(`notifyUser failed for ${p.id}:`, err);
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
