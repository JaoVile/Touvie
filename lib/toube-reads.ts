// Consultas de LEITURA do Toube (Fase 5). Executam na hora (sem confirmação —
// ler não muda nada) e devolvem um resumo COMPACTO em texto pro modelo responder
// com números reais. Tudo escopado por user_id (defesa além do RLS, já que o
// smoke pode rodar com service_role). O DIÁRIO (journal_entries/diary_keys) é
// intocável: nenhuma consulta dele existe aqui, em nenhuma hipótese.
import type { Database } from "@/lib/supabase/types";
import { formatBRL } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export const READ_TOOL_NAMES = [
  "consultar_financas",
  "consultar_rotina",
  "consultar_treino",
  "consultar_dieta",
  "consultar_notas",
] as const;

const todayBRT = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export async function executeToubeRead(
  supabase: Client,
  userId: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    switch (tool) {
      case "consultar_financas":
        return await financas(supabase, userId, args);
      case "consultar_rotina":
        return await rotina(supabase, userId);
      case "consultar_treino":
        return await treino(supabase, userId);
      case "consultar_dieta":
        return await dieta(supabase, userId);
      case "consultar_notas":
        return await notas(supabase, userId);
      default:
        return "Consulta desconhecida.";
    }
  } catch {
    return "Não consegui consultar agora — responda que houve um erro ao buscar os dados.";
  }
}

async function financas(
  supabase: Client,
  userId: string,
  args: Record<string, unknown>,
): Promise<string> {
  const mes = /^\d{4}-\d{2}$/.test(String(args.mes ?? ""))
    ? String(args.mes)
    : todayBRT().slice(0, 7);
  const first = `${mes}-01`;
  const [y, m] = mes.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  // .returns<T>() porque o embed finance_categories(name) não resolve sozinho
  // sem metadata de Relationship no Database type (mesmo padrão do webhook).
  type Row = {
    kind: "income" | "expense";
    amount_cents: number;
    occurred_on: string;
    description: string | null;
    finance_categories: { name: string } | null;
  };
  const { data } = await supabase
    .from("transactions")
    .select("kind, amount_cents, occurred_on, description, finance_categories(name)")
    .eq("user_id", userId)
    .gte("occurred_on", first)
    .lt("occurred_on", next)
    .order("occurred_on", { ascending: false })
    // Alto o bastante pra somar o MÊS INTEIRO (200 antes truncava e o "quanto
    // gastei" mentia). Só os "últimos" abaixo são fatiados pra exibição.
    .limit(5000)
    .returns<Row[]>();
  const txs = data ?? [];
  if (!txs.length) return `FINANÇAS ${mes}: nenhum lançamento registrado nesse mês.`;

  let income = 0;
  let expense = 0;
  const byCat: Record<string, number> = {};
  for (const t of txs) {
    if (t.kind === "income") income += t.amount_cents;
    else {
      expense += t.amount_cents;
      const c = t.finance_categories?.name ?? "Sem categoria";
      byCat[c] = (byCat[c] ?? 0) + t.amount_cents;
    }
  }
  const top = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([n, c]) => `${n} ${formatBRL(c)}`)
    .join(" · ");
  const ultimos = txs
    .slice(0, 8)
    .map(
      (t) =>
        `${t.occurred_on} ${t.kind === "income" ? "+" : "-"}${formatBRL(t.amount_cents)}${t.description ? ` ${t.description}` : ""}`,
    )
    .join("\n");
  return `FINANÇAS ${mes} (${txs.length} lançamentos):
Receitas ${formatBRL(income)} · Gastos ${formatBRL(expense)} · Saldo ${income - expense >= 0 ? "+" : ""}${formatBRL(income - expense)}
Top gastos por categoria: ${top || "—"}
Últimos lançamentos:
${ultimos}`;
}

async function rotina(supabase: Client, userId: string): Promise<string> {
  const today = todayBRT();
  const [{ data: blocks }, { data: done }] = await Promise.all([
    supabase
      .from("routine_daily")
      .select("id, time_slot, title")
      .eq("user_id", userId)
      .eq("active", true)
      .order("time_slot"),
    supabase
      .from("routine_completions")
      .select("routine_id")
      .eq("user_id", userId)
      .eq("completed_on", today),
  ]);
  if (!blocks?.length) return "ROTINA: nenhum bloco cadastrado.";
  const doneSet = new Set((done ?? []).map((d) => d.routine_id));
  const lines = blocks
    .map(
      (b) =>
        `${b.time_slot.slice(0, 5)} ${b.title} ${doneSet.has(b.id) ? "✓ feito" : "○ pendente"}`,
    )
    .join("\n");
  return `ROTINA DE HOJE (${today}) — ${doneSet.size}/${blocks.length} concluídos:\n${lines}`;
}

const WD_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Programa ativo com dias e exercícios-alvo — pro Toube saber "o treino de amanhã". */
async function programaAtivo(supabase: Client, userId: string): Promise<string> {
  const { data: prog } = await supabase
    .from("workout_programs")
    .select("id, name")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1) // se por inconsistência houver 2 ativos, pega 1 em vez de o maybeSingle dar erro
    .maybeSingle();
  if (!prog) return "";
  const { data: days } = await supabase
    .from("workout_days")
    .select("id, weekday, name")
    .eq("program_id", prog.id)
    .order("weekday");
  if (!days?.length) return `\n\nPROGRAMA ATIVO "${prog.name}": sem dias cadastrados.`;
  type JRow = {
    program_day_id: string;
    sort_order: number;
    target_sets: number | null;
    target_reps_low: number | null;
    target_reps_high: number | null;
    exercises: { name: string } | null;
  };
  const { data: exs } = await supabase
    .from("workout_day_exercises")
    .select(
      "program_day_id, sort_order, target_sets, target_reps_low, target_reps_high, exercises(name)",
    )
    .in(
      "program_day_id",
      days.map((d) => d.id),
    )
    .order("sort_order")
    .returns<JRow[]>();
  const byDay = new Map<string, JRow[]>();
  for (const e of exs ?? []) {
    const list = byDay.get(e.program_day_id) ?? [];
    list.push(e);
    byDay.set(e.program_day_id, list);
  }
  const linhas = days
    .map((d) => {
      const items = (byDay.get(d.id) ?? [])
        .map(
          (e) =>
            `${e.exercises?.name ?? "?"}${e.target_sets ? ` ${e.target_sets}x${e.target_reps_low ?? "?"}-${e.target_reps_high ?? "?"}` : ""}`,
        )
        .join(" · ");
      return `${WD_LONG[d.weekday]} — ${d.name}: ${items || "(sem exercícios)"}`;
    })
    .join("\n");
  return `\n\nPROGRAMA ATIVO "${prog.name}" (dias da semana):\n${linhas}`;
}

async function treino(supabase: Client, userId: string): Promise<string> {
  type LogRow = {
    set_number: number;
    reps: number | null;
    weight_kg: number | null;
    rpe: number | null;
    exercises: { name: string } | null;
    workout_sessions: { occurred_on: string } | null;
  };
  const [{ data: logs }, { data: prs }] = await Promise.all([
    supabase
      .from("exercise_logs")
      .select("set_number, reps, weight_kg, rpe, exercises(name), workout_sessions(occurred_on)")
      .eq("user_id", userId)
      .order("id", { ascending: false })
      .limit(15)
      .returns<LogRow[]>(),
    supabase
      .from("personal_records")
      .select("exercise_name, best_weight, best_1rm, total_sets, last_logged_on")
      .eq("user_id", userId)
      .order("best_weight", { ascending: false })
      .limit(10),
  ]);
  const programa = await programaAtivo(supabase, userId);
  if (!logs?.length && !prs?.length && !programa) {
    return "TREINO: nenhum programa ativo e nenhuma série logada ainda.";
  }
  const ultimas = (logs ?? [])
    .map(
      (l) =>
        `${l.workout_sessions?.occurred_on ?? "?"} ${l.exercises?.name ?? "?"}: ${l.weight_kg ?? "?"}kg×${l.reps ?? "?"}${l.rpe ? ` @${l.rpe}` : ""}`,
    )
    .join("\n");
  const recordes = (prs ?? [])
    .map(
      (p) =>
        `${p.exercise_name}: ${p.best_weight ?? "?"}kg (1RM~${p.best_1rm ?? "?"}kg, ${p.total_sets} séries)`,
    )
    .join("\n");
  return `TREINO — últimas séries:\n${ultimas || "—"}\n\nRecordes (PRs):\n${recordes || "—"}${programa}`;
}

async function dieta(supabase: Client, userId: string): Promise<string> {
  const today = todayBRT();
  const { data: meds } = await supabase
    .from("body_measurements")
    .select("measured_on, weight_kg, waist_cm, bodyfat_pct")
    .eq("user_id", userId)
    .order("measured_on", { ascending: false })
    .limit(5);
  const { data: mealsToday } = await supabase
    .from("meals")
    .select("id, meal_type")
    .eq("user_id", userId)
    .eq("occurred_on", today);
  type ItemRow = { grams: number; foods: { name: string; kcal_per_100g: number } | null };
  let itens: ItemRow[] = [];
  if (mealsToday?.length) {
    const { data } = await supabase
      .from("meal_items")
      .select("grams, foods(name, kcal_per_100g)")
      .eq("user_id", userId)
      .in(
        "meal_id",
        mealsToday.map((m) => m.id),
      )
      .returns<ItemRow[]>();
    itens = data ?? [];
  }
  const medidas = (meds ?? [])
    .map(
      (m) =>
        `${m.measured_on}: ${m.weight_kg ?? "?"}kg${m.waist_cm ? `, cintura ${m.waist_cm}cm` : ""}${m.bodyfat_pct ? `, ${m.bodyfat_pct}% gordura` : ""}`,
    )
    .join("\n");
  const kcal = itens.reduce((s, i) => s + ((i.foods?.kcal_per_100g ?? 0) * i.grams) / 100, 0);
  const comidas = itens
    .map((i) => `${i.foods?.name ?? "?"} ${i.grams}g`)
    .slice(0, 12)
    .join(" · ");
  return `DIETA — últimas medidas:\n${medidas || "nenhuma medida registrada"}\n\nHoje (${today}): ${
    itens.length
      ? `${itens.length} itens (~${Math.round(kcal)} kcal): ${comidas}`
      : "nenhuma refeição registrada"
  }`;
}

async function notas(supabase: Client, userId: string): Promise<string> {
  const { data } = await supabase
    .from("notes")
    .select("title, pinned, updated_at")
    .eq("user_id", userId)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(20);
  if (!data?.length) return "NOTAS: nenhuma nota salva.";
  const lines = data.map((n) => `${n.pinned ? "📌 " : ""}${n.title || "(sem título)"}`).join("\n");
  return `NOTAS (${data.length} mais recentes — só os títulos; o conteúdo abre no módulo Notas):\n${lines}`;
}
