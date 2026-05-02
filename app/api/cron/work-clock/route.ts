import { logEvent } from "@/lib/logger";
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

const MESSAGES: Record<string, string> = {
  "clock-in-morning": "⏰ <b>BATER PONTO</b>\n\nBom dia! Hora de iniciar o expediente.",
  "lunch-break": "🍽️ <b>PAUSAR PARA O ALMOÇO</b>\n\nHora do almoço — bater ponto de saída.",
  "clock-in-afternoon": "⏰ <b>BATER PONTO NOVAMENTE</b>\n\nVolta do almoço — bater ponto de entrada.",
  "clock-out": "🏁 <b>FINALIZAR PONTO</b>\n\nFim do expediente — bater ponto de saída.",
};

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  const text = MESSAGES[type];
  if (!text) {
    return NextResponse.json({ error: "invalid_type", type }, { status: 400 });
  }

  const admin = createAdminClient();
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
    source: "cron/work-clock",
    status: sent > 0 ? "success" : "warning",
    messagePreview: text,
    metadata: { sent, type, profiles: profiles.length },
  });

  return NextResponse.json({ ok: true, sent, type });
}
