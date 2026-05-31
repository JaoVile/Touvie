import { todayBRT } from "@/lib/datetime";
import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// Regenera as contas (bills) recorrentes mensais para o PRÓXIMO mês.
// Idempotente: pode rodar qualquer dia / quantas vezes quiser — só cria o
// que faltar. Garante que o mês seguinte sempre tenha as bills "monthly",
// pra que no virar do mês a lista já esteja lá (zerada/não-paga).

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${expected}`) return true;
  if (req.headers.get("x-cron-secret") === expected) return true;
  return false;
}

// "2026-06" + n meses -> "2026-07"
function addMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// dia "30" em fevereiro -> último dia válido do mês
function clampDay(ym: string, day: number): string {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

interface BillRow {
  id: string;
  title: string;
  amount_cents: number;
  due_date: string; // YYYY-MM-DD
  recurrence_rule: string | null;
  category_id: string | null;
  notes: string | null;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const thisMonth = todayBRT().toISOString().slice(0, 7); // YYYY-MM

  // Mês-alvo: por padrão o próximo mês; ?month=YYYY-MM força um específico
  // (útil pra rodar manualmente / preencher um mês pulado).
  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month");
  const targetMonth = /^\d{4}-\d{2}$/.test(monthParam ?? "")
    ? (monthParam as string)
    : addMonth(thisMonth, 1);

  // Todas as bills recorrentes mensais de todos os usuários
  const { data: bills, error } = await admin
    .from("bills")
    .select("id, user_id, title, amount_cents, due_date, recurrence_rule, category_id, notes")
    .eq("recurrence_rule", "monthly");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Agrupa por usuário; chave = título + DIA do vencimento, pra que duas
  // bills de mesmo nome em dias diferentes (ex: "Galão de água" dia 7 e 21)
  // não se fundam. Pra cada chave pega a ocorrência MAIS RECENTE como
  // template (assim mudanças de valor/categoria propagam pro próximo mês).
  const byUser = new Map<string, Map<string, BillRow>>();
  for (const b of (bills ?? []) as Array<BillRow & { user_id: string }>) {
    if (!byUser.has(b.user_id)) byUser.set(b.user_id, new Map());
    const templates = byUser.get(b.user_id)!;
    const key = `${b.title}|${b.due_date.slice(8, 10)}`; // título + dia
    const prev = templates.get(key);
    if (!prev || b.due_date > prev.due_date) templates.set(key, b);
  }

  let created = 0;
  const perUser: Record<string, number> = {};

  for (const [userId, templates] of byUser) {
    // O que já existe no mês-alvo pra esse user (evita duplicar).
    // Chave título+dia, igual ao agrupamento dos templates.
    const { data: existing } = await admin
      .from("bills")
      .select("title, due_date")
      .eq("user_id", userId)
      .gte("due_date", `${targetMonth}-01`)
      .lte("due_date", clampDay(targetMonth, 31));
    const existingKeys = new Set(
      (existing ?? []).map((e) => `${e.title}|${e.due_date.slice(8, 10)}`),
    );

    const toInsert = [];
    for (const tpl of templates.values()) {
      const day = Number(tpl.due_date.slice(8, 10));
      const targetDue = clampDay(targetMonth, day);
      if (existingKeys.has(`${tpl.title}|${targetDue.slice(8, 10)}`)) continue;
      toInsert.push({
        user_id: userId,
        title: tpl.title,
        amount_cents: tpl.amount_cents,
        due_date: targetDue,
        recurrence_rule: "monthly",
        category_id: tpl.category_id,
        notes: tpl.notes,
        // paid_at fica null -> entra como pendente
      });
    }

    if (toInsert.length > 0) {
      const { error: insErr } = await admin.from("bills").insert(toInsert);
      if (insErr) {
        console.error(`regenerate-bills: insert falhou para ${userId}:`, insErr.message);
        continue;
      }
      created += toInsert.length;
      perUser[userId] = toInsert.length;
    }
  }

  logEvent({
    userId: byUser.size > 0 ? [...byUser.keys()][0] : null,
    eventType: "cron",
    source: "cron/regenerate-bills",
    status: "success",
    messagePreview: `${created} bill(s) criadas para ${targetMonth}`,
    metadata: { targetMonth, created, users: byUser.size },
  });

  return NextResponse.json({ ok: true, targetMonth, created, perUser });
}
