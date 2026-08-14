import { todayBRT, todayBRTISO, tomorrowBRTISO } from "@/lib/datetime";
import { logEvent } from "@/lib/logger";
import { CRON_FALLBACK } from "@/lib/notification-defaults";
import { renderTemplate } from "@/lib/notifications/render";
import { EVENING_VARS, buildContext } from "@/lib/notifications/variables";
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
    .eq("key", "cron:evening")
    .maybeSingle();

  const template =
    tpl?.is_active === false ? null : (tpl?.content ?? CRON_FALLBACK["cron:evening"]);
  if (!template) {
    return NextResponse.json({ ok: true, sent: 0, reason: "template_inactive" });
  }

  const { data: profiles, error: profilesErr } = await admin
    .from("profiles")
    // SEM `.not("telegram_chat_id", ...)`: quem usa só push também precisa
    // aparecer aqui, senão a notificação própria nunca sai.
    .select("id, notify_push, notify_telegram")
    .or("notify_push.eq.true,notify_telegram.eq.true");

  // Consulta que falha deixava `profiles` null e a rodada respondia
  // `ok: true, reason: "no_subscribers"` ANTES do logEvent — uma rodada
  // inteira sumia sem rastro. Formato espelhado do reminders-sweep.
  if (profilesErr) {
    logEvent({
      eventType: "cron",
      source: "cron/evening-reminders",
      status: "error",
      messagePreview: profilesErr.message,
    });
    return NextResponse.json({ error: profilesErr.message }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_subscribers" });
  }

  let sent = 0;
  let firstText: string | undefined;
  for (const p of profiles) {
    const ctx = buildContext(admin, p.id, today, tomorrow, weekday);
    const text = await renderTemplate(template, ctx, EVENING_VARS);
    // Se o template virou só o "Boa noite!" (todas as seções dinâmicas
    // vieram vazias), não envia ruído — exige pelo menos uma quebra de
    // linha além do greeting.
    if (!text || !text.includes("\n")) continue;
    if (!firstText) firstText = text;
    try {
      const r = await notifyUser(admin, p.id, { text, url: "/" });
      // `sent` passa a contar entrega REAL (algum canal recebeu), não tentativa.
      if (r.push > 0 || r.telegram) sent += 1;
    } catch (err) {
      console.error(`notifyUser failed for ${p.id}:`, err);
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
