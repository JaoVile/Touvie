import { todayBRT, todayBRTISO } from "@/lib/datetime";
import { logEvent } from "@/lib/logger";
import { notifyUser } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml } from "@/lib/telegram";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// O cron-mestre bate aqui a cada ~5 min. Aceitamos disparar se o horário-alvo
// passou nos últimos SLACK minutos (folga pro cron não cair no minuto exato).
const SLACK_MIN = 6;

type Row = {
  id: string;
  user_id: string;
  message: string;
  schedule_type: "daily" | "weekly" | "interval" | "once";
  at_time: string | null;
  on_date: string | null;
  days: number[] | null;
  every_hours: number | null;
  window_from: string | null;
  window_to: string | null;
  last_fired_at: string | null;
};

function toMin(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Minutos-do-dia em que o lembrete deveria disparar hoje (weekday BRT). */
function targetsToday(r: Row, weekday: number): number[] {
  if (r.schedule_type === "once") {
    // Dispara só no dia marcado (BRT). Depois de disparar, o sweep desativa (active=false).
    if (r.on_date !== todayBRTISO()) return [];
    const t = toMin(r.at_time);
    return t === null ? [] : [t];
  }
  if (r.schedule_type === "daily") {
    const t = toMin(r.at_time);
    return t === null ? [] : [t];
  }
  if (r.schedule_type === "weekly") {
    if (!r.days?.includes(weekday)) return [];
    const t = toMin(r.at_time);
    return t === null ? [] : [t];
  }
  // interval: do início ao fim da janela, de every_hours em every_hours.
  const from = toMin(r.window_from);
  const to = toMin(r.window_to);
  const every = (r.every_hours ?? 0) * 60;
  if (from === null || to === null || every <= 0) return [];
  const out: number[] = [];
  for (let t = from; t <= to; t += every) out.push(t);
  return out;
}

/** Bate o horário agora E não disparou nesse mesmo ciclo (anti-duplicata). */
function shouldFire(r: Row, nowMin: number, weekday: number, nowMs: number): boolean {
  const hit = targetsToday(r, weekday).some((t) => nowMin >= t && nowMin < t + SLACK_MIN);
  if (!hit) return false;
  if (r.last_fired_at) {
    const minsSince = (nowMs - new Date(r.last_fired_at).getTime()) / 60000;
    // intervalo: trava por quase um ciclo; diário/semanal: 50 min (1×/horário).
    const dedup = r.schedule_type === "interval" ? (r.every_hours ?? 1) * 60 - SLACK_MIN : 50;
    if (minsSince < dedup) return false;
  }
  return true;
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  const xcron = req.headers.get("x-cron-secret");
  return auth === `Bearer ${secret}` || xcron === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // todayBRT() usa toZonedTime, que expõe a parede de São Paulo nos getters
  // LOCAIS (verificado empiricamente: getHours()/getDay() dão 20:30/sexta com
  // TZ=UTC, America/Sao_Paulo e America/New_York; os getters UTC só acertam num
  // runtime em UTC). Por isso getters locais — corretos em qualquer fuso.
  const z = todayBRT();
  const nowMin = z.getHours() * 60 + z.getMinutes();
  const weekday = z.getDay();
  const nowMs = Date.now();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_reminders")
    .select(
      "id, user_id, message, schedule_type, at_time, on_date, days, every_hours, window_from, window_to, last_fired_at",
    )
    .eq("active", true);

  if (error) {
    logEvent({
      eventType: "cron",
      source: "cron/reminders-sweep",
      status: "error",
      messagePreview: error.message,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const due = ((data ?? []) as Row[]).filter((r) => shouldFire(r, nowMin, weekday, nowMs));

  let sent = 0;
  let failed = 0;
  for (const r of due) {
    try {
      const res = await notifyUser(admin, r.user_id, {
        text: `🔔 <b>${escapeHtml(r.message)}</b>`,
        url: "/notificacoes",
        // Um tag por lembrete: dois vencidos na mesma varredura são duas
        // notificações, não uma sobrescrevendo a outra.
        tag: `reminder:${r.id}`,
      });
      // 'once' é uma vez só: desativa depois de disparar (não repete nunca mais).
      await admin
        .from("user_reminders")
        .update({
          last_fired_at: new Date().toISOString(),
          ...(r.schedule_type === "once" ? { active: false } : {}),
        })
        .eq("id", r.id);
      if (res.push > 0 || res.telegram) sent++;
    } catch (err) {
      failed++;
      console.error("reminders-sweep send failed", r.id, err);
    }
  }

  logEvent({
    eventType: "cron",
    source: "cron/reminders-sweep",
    status: failed > 0 ? "warning" : "success",
    messagePreview: `sweep: ${sent} enviados, ${failed} falhas (${due.length} no horário)`,
    metadata: { due: due.length, sent, failed, nowMin, weekday },
  });

  return NextResponse.json({ ok: true, due: due.length, sent, failed });
}
