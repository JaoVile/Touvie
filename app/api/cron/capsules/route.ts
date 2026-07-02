import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, sendMessage } from "@/lib/telegram";
import { NextResponse } from "next/server";

// Cron diário (09:00 BRT): cápsulas cujo opens_at chegou ganham um aviso no
// Telegram e são marcadas com notified_at. Quem não tem Telegram vinculado
// fica sem aviso (a cápsula aparece "chegou" no app do mesmo jeito) e será
// re-tentado nos próximos dias — se vincular depois, ainda recebe.
//
// Privacidade: só o TÍTULO viaja na mensagem (o conteúdo pode estar cifrado
// zero-knowledge e, mesmo em texto puro, não pertence a um chat de bot).

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
  const now = new Date().toISOString();

  const { data: due } = await admin
    .from("time_capsules")
    .select("id, user_id, title")
    .lte("opens_at", now)
    .is("notified_at", null);

  if (!due || due.length === 0) {
    return NextResponse.json({ ok: true, due: 0, sent: 0 });
  }

  const userIds = [...new Set(due.map((c) => c.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, telegram_chat_id")
    .in("id", userIds)
    .not("telegram_chat_id", "is", null);
  const chatByUser = new Map((profiles ?? []).map((p) => [p.id, p.telegram_chat_id]));

  let sent = 0;
  const notifiedIds: string[] = [];
  for (const c of due) {
    const chat = chatByUser.get(c.user_id);
    if (!chat) continue;
    const name = c.title.trim() ? `«${escapeHtml(c.title.trim())}»` : "Uma carta sua";
    try {
      await sendMessage(
        chat,
        `🌌 <b>Voltou do universo</b>\n\n${name} chegou ao dia marcado. E aí — como foi?\n\nAbra no Touvie, em Cápsulas.`,
      );
      sent += 1;
      notifiedIds.push(c.id);
    } catch (err) {
      console.error(`Telegram send failed for capsule ${c.id}:`, err);
    }
  }

  if (notifiedIds.length > 0) {
    await admin
      .from("time_capsules")
      .update({ notified_at: now, updated_at: now })
      .in("id", notifiedIds);
  }

  logEvent({
    userId: due[0]?.user_id ?? null,
    eventType: "cron",
    source: "cron/capsules",
    status: sent > 0 ? "success" : "warning",
    messagePreview: `${sent}/${due.length} cápsulas notificadas`,
    metadata: { due: due.length, sent },
  });

  return NextResponse.json({ ok: true, due: due.length, sent });
}
