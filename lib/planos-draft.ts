// Lógica pura do rascunho de plano (sem I/O). O modelo (Groq) chama tools que
// viram mutações; applyMutation aplica de forma determinística e defensiva —
// input do modelo é NÃO confiável, então tudo é validado/clamp e mutação
// inválida é ignorada (retorna o plano intacto).

export type PlanExercise = {
  name: string;
  muscle_group?: string | null;
  target_sets?: number | null;
  reps_low?: number | null;
  reps_high?: number | null;
  notes?: string | null;
};

export type PlanDay = {
  weekday: number; // 0=Dom … 6=Sáb
  name: string;
  exercises: PlanExercise[];
};

export type Plan = {
  name: string;
  days: PlanDay[];
};

export const EMPTY_PLAN: Plan = { name: "", days: [] };

export const PLAN_TOOL_NAMES = [
  "montar_do_zero",
  "definir_nome",
  "add_dia",
  "editar_dia",
  "remover_dia",
  "add_exercicio",
  "editar_exercicio",
  "remover_exercicio",
] as const;

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

const clampInt = (v: unknown, lo: number, hi: number): number | null => {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};

/** Resolve um índice de array de forma ESTRITA — fora do range é null (nunca clampeia). */
const idx = (v: unknown, length: number): number | null => {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  return Number.isInteger(n) && n >= 0 && n < length ? n : null;
};

function cleanExercise(raw: unknown): PlanExercise | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name, 80);
  if (!name) return null;
  return {
    name,
    muscle_group: str(r.muscle_group, 40),
    target_sets: clampInt(r.target_sets, 1, 20),
    reps_low: clampInt(r.reps_low, 1, 50),
    reps_high: clampInt(r.reps_high, 1, 50),
    notes: str(r.notes, 200),
  };
}

function cleanDay(raw: unknown): PlanDay | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name, 60);
  const weekday = clampInt(r.weekday, 0, 6);
  if (!name || weekday === null) return null;
  const exercises = Array.isArray(r.exercises)
    ? r.exercises.map(cleanExercise).filter((e): e is PlanExercise => e !== null)
    : [];
  return { weekday, name, exercises };
}

/** Aplica uma mutação vinda do modelo. Sempre retorna um plano válido. */
export function applyMutation(plan: Plan, tool: string, args: Record<string, unknown>): Plan {
  const days = plan.days.map((d) => ({ ...d, exercises: [...d.exercises] }));
  const next: Plan = { name: plan.name, days };
  const di = idx(args.dia_index, days.length);
  const day = di !== null ? days[di] : undefined;

  switch (tool) {
    case "montar_do_zero": {
      const name = str(args.name, 80) ?? "Novo plano";
      const newDays = Array.isArray(args.days)
        ? args.days.map(cleanDay).filter((d): d is PlanDay => d !== null)
        : [];
      return { name, days: newDays };
    }
    case "definir_nome": {
      const name = str(args.name, 80);
      return name ? { ...next, name } : next;
    }
    case "add_dia": {
      const d = cleanDay({ weekday: args.weekday, name: args.name, exercises: [] });
      if (d) days.push(d);
      return next;
    }
    case "editar_dia": {
      if (!day) return next;
      const name = str(args.name, 60);
      const weekday = clampInt(args.weekday, 0, 6);
      if (name) day.name = name;
      if (weekday !== null) day.weekday = weekday;
      return next;
    }
    case "remover_dia": {
      if (di !== null) days.splice(di, 1);
      return next;
    }
    case "add_exercicio": {
      if (!day) return next;
      const ex = cleanExercise(args);
      if (ex) day.exercises.push(ex);
      return next;
    }
    case "editar_exercicio": {
      if (!day) return next;
      const ei = idx(args.ex_index, day.exercises.length);
      if (ei === null) return next;
      const cur = day.exercises[ei];
      const merged = cleanExercise({ ...cur, ...args });
      if (merged) day.exercises[ei] = merged;
      return next;
    }
    case "remover_exercicio": {
      if (!day) return next;
      const ei = idx(args.ex_index, day.exercises.length);
      if (ei !== null) day.exercises.splice(ei, 1);
      return next;
    }
    default:
      return next;
  }
}

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Serializa o plano com índices pro modelo editar sem ambiguidade. */
export function describePlanForModel(plan: Plan): string {
  if (!plan.days.length) return `RASCUNHO ATUAL: vazio (nome: "${plan.name || "sem nome"}").`;
  const dias = plan.days
    .map((d, i) => {
      const exs = d.exercises
        .map(
          (e, j) =>
            `    [ex ${j}] ${e.name}${e.target_sets ? ` — ${e.target_sets}x${e.reps_low ?? "?"}-${e.reps_high ?? "?"}` : ""}`,
        )
        .join("\n");
      return `  [dia ${i}] ${WD[d.weekday]} — ${d.name}\n${exs || "    (sem exercícios)"}`;
    })
    .join("\n");
  return `RASCUNHO ATUAL (nome: "${plan.name || "sem nome"}"):\n${dias}`;
}
