import { logEvent } from "@/lib/logger";
import { WORK_CLOCK_FALLBACK } from "@/lib/notification-defaults";
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

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  if (!WORK_CLOCK_FALLBACK[type]) {
    return NextResponse.json({ error: "invalid_type", type }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: tpl } = await admin
    .from("notification_templates")
    .select("content, is_active")
    .eq("key", `work-clock:${type}`)
    .maybeSingle();

  const text = tpl?.is_active ? tpl.content : (WORK_CLOCK_FALLBACK[type] ?? "");
  if (!text) {
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
      source: "cron/work-clock",
      status: "error",
      messagePreview: profilesErr.message,
    });
    return NextResponse.json({ error: profilesErr.message }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_subscribers" });
  }

  let sent = 0;
  for (const p of profiles) {
    try {
      const r = await notifyUser(admin, p.id, { text, url: "/rotina" });
      // `sent` passa a contar entrega REAL (algum canal recebeu), não tentativa.
      if (r.push > 0 || r.telegram) sent += 1;
    } catch (err) {
      console.error(`notifyUser failed for ${p.id}:`, err);
    }
  }

  logEvent({
    userId: profiles[0]?.id ?? null,
    eventType: "cron",
    source: "cron/work-clock",
    status: sent > 0 ? "success" : "warning",
    messagePreview: text,
    metadata: { sent, type, profiles: profiles.length },
  });

  return NextResponse.json({ ok: true, sent, type });
}
