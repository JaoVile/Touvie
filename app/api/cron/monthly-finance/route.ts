import { todayBRT, todayBRTISO, tomorrowBRTISO } from "@/lib/datetime";
import { logEvent } from "@/lib/logger";
import { CRON_FALLBACK } from "@/lib/notification-defaults";
import { renderTemplate } from "@/lib/notifications/render";
import { MONTHLY_VARS, buildContext } from "@/lib/notifications/variables";
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

// Roda no último dia do mês. cron-job.org não tem "last day of month"
// nativo — agende como "28-31 21:00" + a checagem abaixo só envia se
// `hoje + 1 dia` for dia 1, garantindo execução única ao fim do mês
// real, sem depender de quantos dias o mês teve.
function isLastDayOfMonth(today: string, tomorrow: string): boolean {
  return tomorrow.slice(8, 10) === "01" && today.slice(0, 7) !== tomorrow.slice(0, 7);
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const admin = createAdminClient();
  const today = todayBRTISO();
  const tomorrow = tomorrowBRTISO();
  const weekday = todayBRT().getUTCDay();

  if (!force && !isLastDayOfMonth(today, tomorrow)) {
    return NextResponse.json({ ok: true, sent: 0, reason: "not_last_day", today });
  }

  const { data: tpl } = await admin
    .from("notification_templates")
    .select("content, is_active")
    .eq("key", "cron:monthly-finance")
    .maybeSingle();

  const template =
    tpl?.is_active === false ? null : (tpl?.content ?? CRON_FALLBACK["cron:monthly-finance"]);
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
      source: "cron/monthly-finance",
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
    const text = await renderTemplate(template, ctx, MONTHLY_VARS);
    if (!text) continue;
    if (!firstText) firstText = text;
    try {
      const r = await notifyUser(admin, p.id, { text, url: "/financas" });
      // `sent` passa a contar entrega REAL (algum canal recebeu), não tentativa.
      if (r.push > 0 || r.telegram) sent += 1;
    } catch (err) {
      console.error(`notifyUser failed for ${p.id}:`, err);
    }
  }

  logEvent({
    userId: profiles[0]?.id ?? null,
    eventType: "cron",
    source: "cron/monthly-finance",
    status: sent > 0 ? "success" : "warning",
    messagePreview: firstText,
    metadata: { sent, profiles: profiles.length, forced: force },
  });

  return NextResponse.json({ ok: true, sent });
}
