import { todayBRT } from "@/lib/datetime";
import { parseRecurrenceRule } from "@/lib/finance";
import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// Materializa as RECEITAS/DESPESAS recorrentes cujo dia já chegou no mês
// corrente — o lado automático do botão "Recebi" da aba Recorrentes. Cada
// recorrência (is_recurring=true) vira uma tx real (is_recurring=false), que
// aí sim entra no saldo. Idempotente via external_ref `rec:<id>:<mês>`: pode
// rodar todo dia / várias vezes que nunca duplica. Basta colar 1 URL no
// cron-job.org apontando pra cá (mesma manha do regenerate-bills).

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${expected}`) return true;
  if (req.headers.get("x-cron-secret") === expected) return true;
  return false;
}

// dia "31" num mês de 30 dias -> último dia válido
function clampDay(ym: string, day: number): string {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

interface RecRow {
  id: string;
  user_id: string;
  amount_cents: number;
  kind: "income" | "expense";
  description: string | null;
  account_id: string | null;
  category_id: string | null;
  recurrence_rule: string | null;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const today = todayBRT().toISOString().slice(0, 10); // YYYY-MM-DD
  const month = today.slice(0, 7); // YYYY-MM
  const todayDay = Number(today.slice(8, 10));

  const { data: recs, error } = await admin
    .from("transactions")
    .select(
      "id, user_id, amount_cents, kind, description, account_id, category_id, recurrence_rule",
    )
    .eq("is_recurring", true);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Candidatos: recorrências cujo dia (clampado ao mês) já chegou.
  const candidates: Array<RecRow & { externalRef: string; occurredOn: string }> = [];
  for (const r of (recs ?? []) as RecRow[]) {
    const day = parseRecurrenceRule(r.recurrence_rule)?.day;
    if (!day) continue;
    const occurredOn = clampDay(month, day);
    if (Number(occurredOn.slice(8, 10)) > todayDay) continue; // ainda não chegou o dia
    candidates.push({ ...r, externalRef: `rec:${r.id}:${month}`, occurredOn });
  }

  let created = 0;
  if (candidates.length > 0) {
    const refs = candidates.map((c) => c.externalRef);
    const { data: existing } = await admin
      .from("transactions")
      .select("external_ref")
      .in("external_ref", refs);
    const existingSet = new Set((existing ?? []).map((e) => e.external_ref as string));

    const toInsert = candidates
      .filter((c) => !existingSet.has(c.externalRef))
      .map((c) => ({
        user_id: c.user_id,
        account_id: c.account_id,
        category_id: c.category_id,
        amount_cents: c.amount_cents,
        kind: c.kind,
        occurred_on: c.occurredOn,
        description: c.description,
        is_recurring: false,
        recurrence_rule: null,
        reminder_enabled: false,
        external_ref: c.externalRef,
      }));

    if (toInsert.length > 0) {
      const { error: insErr } = await admin.from("transactions").insert(toInsert);
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      created = toInsert.length;
    }
  }

  logEvent({
    userId: null,
    eventType: "cron",
    source: "cron/post-recurring",
    status: "success",
    messagePreview: `${created} recorrência(s) lançada(s) em ${month}`,
    metadata: { month, created, candidates: candidates.length },
  });

  return NextResponse.json({ ok: true, month, created, candidates: candidates.length });
}
