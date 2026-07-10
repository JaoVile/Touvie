# Toube Planos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir uma sub-seção `/toube/planos` onde o usuário monta um programa de treino num chat guiado (com ingestão opcional de link/YouTube/PDF), o Toube edita um rascunho vivo, e no fim cadastra tudo no app num único confirmar.

**Architecture:** Rascunho persistido como JSONB (`workout_program_drafts`). Cada turno de chat manda o rascunho + histórico pro Groq `llama-3.3-70b`, que chama tools que MUTAM o rascunho; o servidor aplica as mutações (determinístico, validado) e devolve o rascunho atualizado, renderizado ao vivo. Edições de rascunho não pedem confirmação; só o commit final (`criarProgramaCompleto`) cria as tabelas reais (programa→dias→exercícios→catálogo), com rollback anti-meio-programa.

**Tech Stack:** Next.js 15 (App Router, Server Actions, Route Handlers), Supabase (Postgres + RLS), Groq (OpenAI-compat), pnpm, Biome, Tailwind v4. Libs novas: `youtube-transcript`, `unpdf`.

## Global Constraints

- Package manager: **pnpm** (nunca npm/yarn). Dev server na porta **3007**.
- Sem testes automatizados. Portão por tarefa: `pnpm check` (biome) + `pnpm exec tsc --noEmit` + `pnpm build` quando tocar em rota/UI, + smoke/E2E via script Node throwaway (`scripts/_*.ts`, removido ao fim).
- Node 22 roda `.ts` direto (type-stripping) — smoke scripts importam módulos do projeto e leem `.env.local` na mão.
- Dinheiro não se aplica aqui; nada de `any` (Biome warna); textos visíveis via `messages/` quando fizer sentido, mas o Toube já usa strings PT-BR inline nos componentes de chat — seguir esse padrão local (ToubeChat.tsx).
- Cliente Supabase: `@/lib/supabase/server` (respeita RLS) nas actions/rotas logadas. Nunca `admin` em código que chega ao browser.
- Migrations rodam MANUALMENTE no SQL Editor do Supabase, em ordem numérica. O plano só cria o arquivo `.sql`; o usuário roda.
- Segredo `GROQ_API_KEY` vive só no `.env.local` (gitignored). Nunca commitar/logar. Já está setado e validado (Groq responde 200 com tool-calling).
- Groq: endpoint `https://api.groq.com/openai/v1/chat/completions`, modelo `llama-3.3-70b-versatile`.
- Padrões a espelhar: `lib/toube.ts` (tools + parse tool_calls), `app/api/toube/route.ts` (contexto + turno), `app/(app)/toube/ToubeChat.tsx` (chat client), `app/(app)/treino/actions.ts` (saves de treino).

---

### Task 1: Migration + types do rascunho

**Files:**
- Create: `supabase/migrations/0028_workout_program_drafts.sql`
- Modify: `lib/supabase/types.ts` (adicionar `workout_program_drafts` no bloco `Tables`)

**Interfaces:**
- Produces: tabela `workout_program_drafts` e o tipo gerado correspondente. Colunas: `id uuid`, `user_id uuid`, `plan jsonb`, `source_kind text|null`, `status 'building'|'committed'`, `created_program_id uuid|null`, `created_at`, `updated_at`.

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/0028_workout_program_drafts.sql`:
```sql
-- Rascunho de programa de treino montado pelo Toube Planos. O plano vive como
-- JSONB até o commit (criarProgramaCompleto), que gera as tabelas reais.
create table public.workout_program_drafts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users on delete cascade,
  plan               jsonb not null default '{}'::jsonb,
  source_kind        text,                              -- 'text' | 'youtube' | 'link' | 'pdf'
  status             text not null default 'building'
                       check (status in ('building', 'committed')),
  created_program_id uuid references public.workout_programs on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.workout_program_drafts enable row level security;

create index workout_program_drafts_open_idx
  on public.workout_program_drafts(user_id, status, updated_at desc);

create policy "own select" on public.workout_program_drafts
  for select using (auth.uid() = user_id);
create policy "own insert" on public.workout_program_drafts
  for insert with check (auth.uid() = user_id);
create policy "own update" on public.workout_program_drafts
  for update using (auth.uid() = user_id);
create policy "own delete" on public.workout_program_drafts
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Adicionar o tipo em `lib/supabase/types.ts`**

Localize o bloco `Tables: {` e adicione (perto de `workout_sessions`, mantendo ordem alfabética aproximada não é exigida — pode ir ao fim do bloco Tables, antes do fechamento):
```ts
      workout_program_drafts: Table<{
        id: string;
        user_id: string;
        plan: Json;
        source_kind: string | null;
        status: "building" | "committed";
        created_program_id: string | null;
        created_at: Timestamptz;
        updated_at: Timestamptz;
      }>;
```

Verifique no topo de `lib/supabase/types.ts` se existe um tipo `Json`. Se NÃO existir, use `Record<string, unknown>` no lugar de `Json` acima. (Rode o grep do Step 3 pra decidir.)

- [ ] **Step 3: Conferir o tipo `Json` e o typecheck**

Run: `grep -nE "type Json|Json =" lib/supabase/types.ts`
Expected: se aparecer uma definição de `Json`, mantenha `plan: Json`. Se vazio, troque por `plan: Record<string, unknown>`.

Run: `pnpm exec tsc --noEmit`
Expected: exit 0 (sem erros).

- [ ] **Step 4: Rodar a migration no Supabase (ação do usuário)**

Peça ao usuário pra colar `supabase/migrations/0028_workout_program_drafts.sql` no SQL Editor do Supabase e dar Run. Depois valide:
```bash
node -e '
import("node:fs").then(async ({readFileSync})=>{
  for(const l of readFileSync(".env.local","utf8").split("\n")){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["\x27]|["\x27]$/g,"").trim();}
  const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r=await fetch(`${u}/rest/v1/workout_program_drafts?select=id&limit=0`,{headers:{apikey:k,Authorization:`Bearer ${k}`}});
  console.log("HTTP",r.status,r.status===200?"OK tabela existe":"AINDA NAO");
});'
```
Expected: `HTTP 200 OK tabela existe`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0028_workout_program_drafts.sql lib/supabase/types.ts
git commit -m "feat(planos): tabela workout_program_drafts + tipo"
```

---

### Task 2: Lógica pura do rascunho (tipos + mutações validadas)

Módulo puro, sem I/O — o coração determinístico que aplica as mutações do modelo. Testável por script de assert.

**Files:**
- Create: `lib/planos-draft.ts`
- Test (throwaway): `scripts/_planos-draft.ts`

**Interfaces:**
- Produces:
  - `type PlanExercise`, `type PlanDay`, `type Plan`
  - `const EMPTY_PLAN: Plan`
  - `function applyMutation(plan: Plan, tool: string, args: Record<string, unknown>): Plan` — retorna NOVO plano; ignora mutação inválida (índice inexistente, tipos errados), clampa weekday 0-6 e ranges de sets/reps.
  - `function describePlanForModel(plan: Plan): string` — serializa o plano com índices `[dia N]` / `[ex M]` pro contexto do modelo.
  - `const PLAN_TOOL_NAMES: string[]` — nomes das 8 tools de mutação.

- [ ] **Step 1: Escrever `lib/planos-draft.ts`**

```ts
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

function cleanExercise(raw: Record<string, unknown>): PlanExercise | null {
  const name = str(raw.name, 80);
  if (!name) return null;
  return {
    name,
    muscle_group: str(raw.muscle_group, 40),
    target_sets: clampInt(raw.target_sets, 1, 20),
    reps_low: clampInt(raw.reps_low, 1, 50),
    reps_high: clampInt(raw.reps_high, 1, 50),
    notes: str(raw.notes, 200),
  };
}

function cleanDay(raw: Record<string, unknown>): PlanDay | null {
  const name = str(raw.name, 60);
  const weekday = clampInt(raw.weekday, 0, 6);
  if (!name || weekday === null) return null;
  const exercises = Array.isArray(raw.exercises)
    ? (raw.exercises as Record<string, unknown>[]).map(cleanExercise).filter((e): e is PlanExercise => e !== null)
    : [];
  return { weekday, name, exercises };
}

/** Aplica uma mutação vinda do modelo. Sempre retorna um plano válido. */
export function applyMutation(plan: Plan, tool: string, args: Record<string, unknown>): Plan {
  const days = plan.days.map((d) => ({ ...d, exercises: [...d.exercises] }));
  const next: Plan = { name: plan.name, days };
  const di = clampInt(args.dia_index, 0, days.length - 1);
  const day = di !== null ? days[di] : undefined;

  switch (tool) {
    case "montar_do_zero": {
      const name = str(args.name, 80) ?? "Novo plano";
      const newDays = Array.isArray(args.days)
        ? (args.days as Record<string, unknown>[]).map(cleanDay).filter((d): d is PlanDay => d !== null)
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
      const ei = clampInt(args.ex_index, 0, day.exercises.length - 1);
      if (ei === null) return next;
      const cur = day.exercises[ei];
      const merged = cleanExercise({ ...cur, ...args });
      if (merged) day.exercises[ei] = merged;
      return next;
    }
    case "remover_exercicio": {
      if (!day) return next;
      const ei = clampInt(args.ex_index, 0, day.exercises.length - 1);
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
```

- [ ] **Step 2: Escrever o script de assert `scripts/_planos-draft.ts`**

```ts
import assert from "node:assert";
import { applyMutation, describePlanForModel, EMPTY_PLAN } from "../lib/planos-draft.ts";

let p = applyMutation(EMPTY_PLAN, "montar_do_zero", {
  name: "ABC",
  days: [{ weekday: 1, name: "Peito", exercises: [{ name: "Supino", target_sets: 4, reps_low: 8, reps_high: 12 }] }],
});
assert.equal(p.name, "ABC");
assert.equal(p.days.length, 1);
assert.equal(p.days[0].exercises[0].name, "Supino");

p = applyMutation(p, "add_dia", { weekday: 3, name: "Perna" });
assert.equal(p.days.length, 2);

p = applyMutation(p, "add_exercicio", { dia_index: 1, name: "Agacho", target_sets: 5 });
assert.equal(p.days[1].exercises[0].name, "Agacho");
assert.equal(p.days[1].exercises[0].target_sets, 5);

// weekday fora de range é clampado
p = applyMutation(p, "add_dia", { weekday: 99, name: "Extra" });
assert.equal(p.days[2].weekday, 6);

// mutação inválida (índice inexistente) é ignorada — plano intacto
const before = JSON.stringify(p);
p = applyMutation(p, "remover_exercicio", { dia_index: 50, ex_index: 0 });
assert.equal(JSON.stringify(p), before);

p = applyMutation(p, "remover_dia", { dia_index: 2 });
assert.equal(p.days.length, 2);

assert.ok(describePlanForModel(p).includes("[dia 0]"));
console.log("OK — todas as asserções passaram");
```

- [ ] **Step 3: Rodar o assert**

Run: `node scripts/_planos-draft.ts 2>&1 | grep -v "Warning\|Reparsing"`
Expected: `OK — todas as asserções passaram`

- [ ] **Step 4: tsc + biome + limpar o script**

Run: `pnpm exec tsc --noEmit && pnpm check && rm scripts/_planos-draft.ts`
Expected: tsc exit 0, biome "No fixes applied".

- [ ] **Step 5: Commit**

```bash
git add lib/planos-draft.ts
git commit -m "feat(planos): lógica pura do rascunho (tipos + mutações validadas)"
```

---

### Task 3: Cliente Groq + adapter Toube Planos

**Files:**
- Create: `lib/groq.ts`
- Create: `lib/toube-planos.ts`
- Modify: `.env.local.example` (documentar GROQ_API_KEY)
- Modify: `docs/OPERATIONS.md` (linha sobre GROQ_API_KEY)
- Test (throwaway): `scripts/_planos-reply.ts`

**Interfaces:**
- Consumes: `Plan`, `describePlanForModel`, `PLAN_TOOL_NAMES` de `lib/planos-draft.ts`. `ChatMessage` de `lib/toube.ts`.
- Produces:
  - `lib/groq.ts`: `async function groqChat(body: Record<string, unknown>): Promise<GroqResponse>` (throws em !ok). `type GroqResponse` com `choices[].message.{content, tool_calls}`.
  - `lib/toube-planos.ts`: `type PlanosResult = { text: string; mutations: { tool: string; args: Record<string, unknown> }[] }`; `async function planosReply(history: ChatMessage[], plan: Plan, sourceText?: string): Promise<PlanosResult>`.

- [ ] **Step 1: Escrever `lib/groq.ts`**

```ts
// Cliente fino do Groq (OpenAI-compatível). Modelo forte e gratuito usado só
// pelo Toube Planos (montar plano estruturado). A key vive só no servidor.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_MODEL = "llama-3.3-70b-versatile";

export type GroqResponse = {
  choices?: {
    message?: {
      content?: string;
      tool_calls?: { function?: { name?: string; arguments?: string } }[];
    };
  }[];
};

export async function groqChat(body: Record<string, unknown>): Promise<GroqResponse> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY não configurada");
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: GROQ_MODEL, ...body }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as GroqResponse;
}
```

- [ ] **Step 2: Escrever `lib/toube-planos.ts`**

```ts
import { groqChat } from "@/lib/groq";
import { describePlanForModel, type Plan, PLAN_TOOL_NAMES } from "@/lib/planos-draft";
import type { ChatMessage } from "@/lib/toube";

export type PlanosResult = {
  text: string;
  mutations: { tool: string; args: Record<string, unknown> }[];
};

const PLANOS_SYSTEM = `Você é o Toube montando um PLANO DE TREINO com a pessoa, dentro do Touvie. Fala PT-BR natural e direto.

COMO VOCÊ TRABALHA:
- Você mantém um RASCUNHO do plano (mostrado abaixo, com índices [dia N] e [ex M]).
- Pra montar/editar o rascunho, CHAME as ferramentas (montar_do_zero, add_dia, add_exercicio, editar_exercicio, remover_dia, etc.). NÃO descreva o plano em texto achando que salvou — só a ferramenta muda o rascunho.
- Se a pessoa deu uma FONTE (texto abaixo em "FONTE:"), use-a como base e chame montar_do_zero com o plano inteiro.
- Se faltar informação pra um bom plano (divisão, quantos dias/semana, objetivo, tempo), PERGUNTE em texto — uma coisa por vez, sem encher.
- Exercícios: use nomes claros em PT-BR (ex.: "Supino reto", "Agachamento livre"). Sugira séries e faixa de reps (target_sets, reps_low, reps_high).
- Pra editar/remover, use os índices EXATOS do rascunho atual.

REGRAS:
1. Uma ferramenta por mudança; pode chamar VÁRIAS no mesmo turno (ex.: montar_do_zero já com todos os dias).
2. NUNCA invente que "já cadastrei no app" — o cadastro é um passo final separado que a pessoa confirma. Você só mexe no rascunho.
3. weekday: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb.`;

const TOOLS = [
  { type: "function", function: { name: "montar_do_zero", description: "Substitui o rascunho inteiro (use ao montar do zero ou a partir da fonte).", parameters: { type: "object", properties: { name: { type: "string" }, days: { type: "array", items: { type: "object", properties: { weekday: { type: "number" }, name: { type: "string" }, exercises: { type: "array", items: { type: "object", properties: { name: { type: "string" }, muscle_group: { type: "string" }, target_sets: { type: "number" }, reps_low: { type: "number" }, reps_high: { type: "number" } }, required: ["name"] } } }, required: ["weekday", "name"] } } }, required: ["name", "days"] } } },
  { type: "function", function: { name: "definir_nome", description: "Renomeia o plano.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "add_dia", description: "Adiciona um dia de treino.", parameters: { type: "object", properties: { weekday: { type: "number" }, name: { type: "string" } }, required: ["weekday", "name"] } } },
  { type: "function", function: { name: "editar_dia", description: "Edita nome/weekday de um dia pelo índice.", parameters: { type: "object", properties: { dia_index: { type: "number" }, weekday: { type: "number" }, name: { type: "string" } }, required: ["dia_index"] } } },
  { type: "function", function: { name: "remover_dia", description: "Remove um dia pelo índice.", parameters: { type: "object", properties: { dia_index: { type: "number" } }, required: ["dia_index"] } } },
  { type: "function", function: { name: "add_exercicio", description: "Adiciona um exercício num dia.", parameters: { type: "object", properties: { dia_index: { type: "number" }, name: { type: "string" }, muscle_group: { type: "string" }, target_sets: { type: "number" }, reps_low: { type: "number" }, reps_high: { type: "number" } }, required: ["dia_index", "name"] } } },
  { type: "function", function: { name: "editar_exercicio", description: "Edita um exercício de um dia pelos índices.", parameters: { type: "object", properties: { dia_index: { type: "number" }, ex_index: { type: "number" }, name: { type: "string" }, muscle_group: { type: "string" }, target_sets: { type: "number" }, reps_low: { type: "number" }, reps_high: { type: "number" } }, required: ["dia_index", "ex_index"] } } },
  { type: "function", function: { name: "remover_exercicio", description: "Remove um exercício de um dia pelos índices.", parameters: { type: "object", properties: { dia_index: { type: "number" }, ex_index: { type: "number" } }, required: ["dia_index", "ex_index"] } } },
];

export async function planosReply(
  history: ChatMessage[],
  plan: Plan,
  sourceText?: string,
): Promise<PlanosResult> {
  const context = sourceText
    ? `${describePlanForModel(plan)}\n\nFONTE (base pro plano — resuma e monte):\n${sourceText.slice(0, 12000)}`
    : describePlanForModel(plan);

  const data = await groqChat({
    tools: TOOLS,
    tool_choice: "auto",
    temperature: 0.6,
    max_tokens: 1500,
    messages: [{ role: "system", content: `${PLANOS_SYSTEM}\n\n${context}` }, ...history],
  });

  const msg = data.choices?.[0]?.message;
  const mutations = (msg?.tool_calls ?? [])
    .filter((t) => PLAN_TOOL_NAMES.includes(t.function?.name as (typeof PLAN_TOOL_NAMES)[number]))
    .map((tc) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function?.arguments || "{}");
      } catch {
        /* args inválidos — applyMutation ignora */
      }
      return { tool: tc.function?.name as string, args };
    });

  const text = msg?.content?.trim() || (mutations.length ? "Atualizei o rascunho aí do lado 👇" : "Me conta como quer o treino.");
  return { text, mutations };
}
```

- [ ] **Step 3: Documentar `GROQ_API_KEY`**

Em `.env.local.example`, adicione ao fim:
```bash
# Groq — modelo do Toube Planos (llama-3.3-70b, free tier). Gere em https://console.groq.com/keys
GROQ_API_KEY=
```
Em `docs/OPERATIONS.md`, adicione uma linha na seção de variáveis/segredos: `GROQ_API_KEY` — chave do Groq (free) usada pelo **Toube Planos** pra montar treino; sem ela, a aba Planos não responde.

- [ ] **Step 4: Escrever o smoke `scripts/_planos-reply.ts`**

```ts
import { readFileSync } from "node:fs";
import { EMPTY_PLAN, applyMutation } from "../lib/planos-draft.ts";
import { planosReply } from "../lib/toube-planos.ts";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}

let plan = EMPTY_PLAN;
const r1 = await planosReply([{ role: "user", content: "monta um ABC de hipertrofia, 3x na semana" }], plan);
console.log("mutations:", r1.mutations.map((m) => m.tool));
for (const m of r1.mutations) plan = applyMutation(plan, m.tool, m.args);
console.log("dias:", plan.days.map((d) => `${d.name} (${d.exercises.length} ex)`));

const r2 = await planosReply([{ role: "user", content: "tira o último dia e põe rosca direta no dia 0" }], plan);
console.log("mutations 2:", r2.mutations.map((m) => m.tool));
```

- [ ] **Step 5: Rodar o smoke + limpar**

Run: `node scripts/_planos-reply.ts 2>&1 | grep -v "Warning\|Reparsing"`
Expected: primeira chamada lista `montar_do_zero` e imprime 3 dias com exercícios; segunda lista mutações de remover/adicionar.

Run: `pnpm exec tsc --noEmit && pnpm check && rm scripts/_planos-reply.ts`
Expected: tsc 0, biome limpo.

- [ ] **Step 6: Commit**

```bash
git add lib/groq.ts lib/toube-planos.ts .env.local.example docs/OPERATIONS.md
git commit -m "feat(planos): cliente Groq + adapter (tools que mutam o rascunho)"
```

---

### Task 4: Actions de persistência (rascunho + commit com rollback)

**Files:**
- Create: `app/(app)/toube/planos/actions.ts`
- Test (throwaway): `scripts/_planos-commit.ts`

**Interfaces:**
- Consumes: `Plan` de `lib/planos-draft.ts`.
- Produces:
  - `async function getOrCreateDraft(): Promise<{ id: string; plan: Plan }>` — pega o rascunho `building` mais recente ou cria um vazio.
  - `async function saveDraftPlan(id: string, plan: Plan): Promise<void>` — persiste o `plan` + `updated_at`.
  - `async function novoRascunho(): Promise<{ id: string }>` — cria rascunho vazio novo (marca outros building como committed? não — só cria; a página abre o mais recente).
  - `async function criarProgramaCompleto(): Promise<{ ok?: boolean; error?: string; programId?: string }>` — o único confirmar; cria programa→dias→exercícios→junctions com rollback.

- [ ] **Step 1: Escrever `app/(app)/toube/planos/actions.ts`**

```ts
"use server";

import { EMPTY_PLAN, type Plan } from "@/lib/planos-draft";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, userId: user.id };
}

export async function getOrCreateDraft(): Promise<{ id: string; plan: Plan }> {
  const { supabase, userId } = await requireUser();
  const { data: existing } = await supabase
    .from("workout_program_drafts")
    .select("id, plan")
    .eq("user_id", userId)
    .eq("status", "building")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { id: existing.id, plan: (existing.plan as Plan) ?? EMPTY_PLAN };

  const { data: created, error } = await supabase
    .from("workout_program_drafts")
    .insert({ user_id: userId, plan: EMPTY_PLAN })
    .select("id, plan")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Erro ao criar rascunho");
  return { id: created.id, plan: created.plan as Plan };
}

export async function saveDraftPlan(id: string, plan: Plan): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("workout_program_drafts")
    .update({ plan, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
}

export async function novoRascunho(): Promise<{ id: string }> {
  const { supabase, userId } = await requireUser();
  // Fecha rascunhos em aberto pra abrir um novo limpo.
  await supabase
    .from("workout_program_drafts")
    .update({ status: "committed" })
    .eq("user_id", userId)
    .eq("status", "building");
  const { data, error } = await supabase
    .from("workout_program_drafts")
    .insert({ user_id: userId, plan: EMPTY_PLAN })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Erro ao criar rascunho");
  revalidatePath("/toube/planos");
  return { id: data.id };
}

export async function criarProgramaCompleto(): Promise<{
  ok?: boolean;
  error?: string;
  programId?: string;
}> {
  const { supabase, userId } = await requireUser();
  const { data: draft } = await supabase
    .from("workout_program_drafts")
    .select("id, plan")
    .eq("user_id", userId)
    .eq("status", "building")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!draft) return { error: "Nenhum rascunho em aberto." };
  const plan = draft.plan as Plan;
  if (!plan?.days?.length) return { error: "O plano está vazio — monta pelo menos um dia." };

  // 1) Programa
  const { data: program, error: pErr } = await supabase
    .from("workout_programs")
    .insert({ user_id: userId, name: plan.name || "Meu treino" })
    .select("id")
    .single();
  if (pErr || !program) return { error: pErr?.message ?? "Falha ao criar o programa." };

  // Rollback helper: apaga o programa (cascade derruba dias/junctions).
  const rollback = async (msg: string) => {
    await supabase.from("workout_programs").delete().eq("id", program.id);
    return { error: msg };
  };

  // Catálogo atual do usuário pra achar-ou-criar exercício por nome (case-insensitive).
  const { data: catalog } = await supabase
    .from("exercises")
    .select("id, name")
    .eq("user_id", userId);
  const byName = new Map((catalog ?? []).map((e) => [e.name.trim().toLowerCase(), e.id]));

  async function ensureExercise(name: string, muscle: string | null | undefined): Promise<string | null> {
    const key = name.trim().toLowerCase();
    const found = byName.get(key);
    if (found) return found;
    const { data: ex, error } = await supabase
      .from("exercises")
      .insert({ user_id: userId, name: name.trim(), muscle_group: muscle ?? null, notes: null })
      .select("id")
      .single();
    if (error || !ex) return null;
    byName.set(key, ex.id);
    return ex.id;
  }

  // 2) Dias + 3) exercícios + junctions
  for (const day of plan.days) {
    const { data: wd, error: dErr } = await supabase
      .from("workout_days")
      .insert({ user_id: userId, program_id: program.id, weekday: day.weekday, name: day.name })
      .select("id")
      .single();
    if (dErr || !wd) return rollback(dErr?.message ?? "Falha ao criar um dia.");

    let sort = 0;
    for (const ex of day.exercises) {
      const exId = await ensureExercise(ex.name, ex.muscle_group);
      if (!exId) return rollback(`Falha no exercício "${ex.name}".`);
      const { error: jErr } = await supabase.from("workout_day_exercises").insert({
        user_id: userId,
        program_day_id: wd.id,
        exercise_id: exId,
        sort_order: sort++,
        target_sets: ex.target_sets ?? null,
        target_reps_low: ex.reps_low ?? null,
        target_reps_high: ex.reps_high ?? null,
        notes: ex.notes ?? null,
      });
      if (jErr) return rollback(jErr.message);
    }
  }

  // 4) Fecha o rascunho
  await supabase
    .from("workout_program_drafts")
    .update({ status: "committed", created_program_id: program.id })
    .eq("id", draft.id);

  revalidatePath("/treino");
  revalidatePath("/toube/planos");
  return { ok: true, programId: program.id };
}
```

- [ ] **Step 2: E2E do commit via `scripts/_planos-commit.ts`**

Este script usa service_role pra: criar um rascunho de teste pra um user real, chamar a lógica de commit por REST (replicando os inserts) NÃO — em vez disso, valida o formato inserindo um rascunho e conferindo colunas. Como as actions exigem sessão autenticada, o E2E real do commit roda pela UI (Task 7). Aqui só garantimos que um rascunho com `plan` válido é aceito pela tabela:
```ts
import { readFileSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}
const u = process.env.NEXT_PUBLIC_SUPABASE_URL, k = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json", Prefer: "return=representation" };
// pega um user_id qualquer
const pr = await (await fetch(`${u}/rest/v1/profiles?select=id&limit=1`, { headers: H })).json();
const uid = pr[0].id;
const plan = { name: "TESTE_PLANOS", days: [{ weekday: 1, name: "Peito", exercises: [{ name: "Supino", target_sets: 4, reps_low: 8, reps_high: 12 }] }] };
const ins = await fetch(`${u}/rest/v1/workout_program_drafts`, { method: "POST", headers: H, body: JSON.stringify({ user_id: uid, plan }) });
const row = (await ins.json())[0];
console.log("inserido:", ins.status, "plan.days:", row.plan.days.length, "status:", row.status);
// limpa
await fetch(`${u}/rest/v1/workout_program_drafts?id=eq.${row.id}`, { method: "DELETE", headers: H });
console.log("limpo");
```

- [ ] **Step 3: Rodar + limpar**

Run: `node scripts/_planos-commit.ts 2>&1 | grep -v "Warning\|Reparsing" && rm scripts/_planos-commit.ts`
Expected: `inserido: 201 plan.days: 1 status: building` e `limpo`.

Run: `pnpm exec tsc --noEmit && pnpm check`
Expected: tsc 0, biome limpo.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/toube/planos/actions.ts"
git commit -m "feat(planos): actions de rascunho + criarProgramaCompleto com rollback"
```

---

### Task 5: Rota de chat `/api/toube/planos`

**Files:**
- Create: `app/api/toube/planos/route.ts`

**Interfaces:**
- Consumes: `getOrCreateDraft`, `saveDraftPlan` de `../../../(app)/toube/planos/actions` (via `@/app/(app)/toube/planos/actions`); `planosReply` de `@/lib/toube-planos`; `applyMutation` de `@/lib/planos-draft`.
- Produces: `POST` que recebe `{ message: string }`, retorna `{ reply: string, plan: Plan }`.

- [ ] **Step 1: Escrever `app/api/toube/planos/route.ts`**

```ts
import { getOrCreateDraft, saveDraftPlan } from "@/app/(app)/toube/planos/actions";
import { applyMutation } from "@/lib/planos-draft";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage } from "@/lib/toube";
import { planosReply } from "@/lib/toube-planos";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({ message: z.string().trim().min(1).max(4000) });

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let message: string;
  try {
    message = bodySchema.parse(await req.json()).message;
  } catch {
    return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
  }

  const { id, plan } = await getOrCreateDraft();

  let result: Awaited<ReturnType<typeof planosReply>>;
  try {
    result = await planosReply([{ role: "user", content: message }], plan);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao falar com o Toube Planos." },
      { status: 502 },
    );
  }

  let nextPlan = plan;
  for (const m of result.mutations) nextPlan = applyMutation(nextPlan, m.tool, m.args);
  if (result.mutations.length) await saveDraftPlan(id, nextPlan);

  return NextResponse.json({ reply: result.text, plan: nextPlan });
}
```

Nota: o histórico do chat Planos NÃO persiste em tabela no v1 (o rascunho é o estado que importa; a conversa vive no client). Cada POST manda só a última mensagem + o rascunho atual — o rascunho serializado dá ao modelo todo o contexto necessário.

- [ ] **Step 2: tsc + build**

Run: `pnpm exec tsc --noEmit && pnpm check`
Expected: tsc 0, biome limpo.

- [ ] **Step 3: Commit**

```bash
git add "app/api/toube/planos/route.ts"
git commit -m "feat(planos): rota de chat que aplica mutações no rascunho"
```

---

### Task 6: Ingestão de fonte (link/YouTube/PDF)

**Files:**
- Create: `lib/planos-source.ts`
- Create: `app/api/toube/planos/fonte/route.ts`
- Modify: `package.json` (deps `youtube-transcript`, `unpdf`)

**Interfaces:**
- Produces:
  - `lib/planos-source.ts`: `async function extractFromUrl(url: string): Promise<{ kind: "youtube" | "link"; text: string }>`; `async function extractFromPdf(buf: ArrayBuffer): Promise<{ kind: "pdf"; text: string }>`. Ambos lançam `Error` com mensagem amigável se não der.
  - `app/api/toube/planos/fonte/route.ts`: `POST` (JSON `{ url }` OU multipart com `file`) → extrai texto → chama `planosReply(history, plan, sourceText)` → aplica → salva → `{ reply, plan }`.

- [ ] **Step 1: Instalar deps**

Run: `pnpm add youtube-transcript unpdf`
Expected: instala sem erro. (`unpdf` extrai texto de PDF sem binários nativos; `youtube-transcript` busca legendas.)

- [ ] **Step 2: Escrever `lib/planos-source.ts`**

```ts
import { extractText, getDocumentProxy } from "unpdf";
import { YoutubeTranscript } from "youtube-transcript";

const YT = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/;

export async function extractFromUrl(url: string): Promise<{ kind: "youtube" | "link"; text: string }> {
  const yt = url.match(YT);
  if (yt) {
    try {
      const parts = await YoutubeTranscript.fetchTranscript(url);
      const text = parts.map((p) => p.text).join(" ");
      if (!text.trim()) throw new Error("empty");
      return { kind: "youtube", text };
    } catch {
      throw new Error("Esse vídeo não tem legenda/transcript disponível. Me descreve o treino que eu monto.");
    }
  }
  // Link comum: fetch + tira tags/scripts, colapsa espaço.
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 Touvie" } });
  if (!res.ok) throw new Error("Não consegui abrir esse link.");
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) throw new Error("Não achei texto útil nesse link.");
  return { kind: "link", text };
}

export async function extractFromPdf(buf: ArrayBuffer): Promise<{ kind: "pdf"; text: string }> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  const clean = (Array.isArray(text) ? text.join(" ") : text).replace(/\s+/g, " ").trim();
  if (!clean) throw new Error("Esse PDF não tem texto extraível (talvez seja escaneado).");
  return { kind: "pdf", text: clean };
}
```

- [ ] **Step 3: Escrever `app/api/toube/planos/fonte/route.ts`**

```ts
import { getOrCreateDraft, saveDraftPlan } from "@/app/(app)/toube/planos/actions";
import { applyMutation } from "@/lib/planos-draft";
import { extractFromPdf, extractFromUrl } from "@/lib/planos-source";
import { createClient } from "@/lib/supabase/server";
import { planosReply } from "@/lib/toube-planos";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let source: { kind: string; text: string };
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const { url } = (await req.json()) as { url?: string };
      if (!url) return NextResponse.json({ error: "Sem URL." }, { status: 400 });
      source = await extractFromUrl(url);
    } else {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "Sem arquivo." }, { status: 400 });
      source = await extractFromPdf(await file.arrayBuffer());
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha na fonte." }, { status: 422 });
  }

  const { id, plan } = await getOrCreateDraft();
  let result: Awaited<ReturnType<typeof planosReply>>;
  try {
    result = await planosReply(
      [{ role: "user", content: "Monta um plano de treino com base nessa fonte." }],
      plan,
      source.text,
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro no Toube Planos." }, { status: 502 });
  }

  let nextPlan = plan;
  for (const m of result.mutations) nextPlan = applyMutation(nextPlan, m.tool, m.args);
  await saveDraftPlan(id, nextPlan);
  await supabase
    .from("workout_program_drafts")
    .update({ source_kind: source.kind })
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ reply: result.text, plan: nextPlan });
}
```

- [ ] **Step 4: Smoke da extração de link (throwaway)**

```ts
// scripts/_planos-source.ts
import { readFileSync } from "node:fs";
import { extractFromUrl } from "../lib/planos-source.ts";
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}
const r = await extractFromUrl("https://pt.wikipedia.org/wiki/Treinamento_de_for%C3%A7a");
console.log(r.kind, "chars:", r.text.length, "|", r.text.slice(0, 100));
```
Run: `node scripts/_planos-source.ts 2>&1 | grep -v "Warning\|Reparsing" && rm scripts/_planos-source.ts`
Expected: `link chars: <n>` com texto legível (n > 500).

- [ ] **Step 5: tsc + build + commit**

Run: `pnpm exec tsc --noEmit && pnpm check && pnpm build`
Expected: tudo verde.
```bash
git add "lib/planos-source.ts" "app/api/toube/planos/fonte/route.ts" package.json pnpm-lock.yaml
git commit -m "feat(planos): ingestão de fonte (link/YouTube/PDF)"
```

---

### Task 7: UI — página, chat, plano vivo, fonte, commit

**Files:**
- Create: `app/(app)/toube/planos/page.tsx`
- Create: `app/(app)/toube/planos/PlanosChat.tsx`
- Create: `app/(app)/toube/planos/PlanPreview.tsx`
- Create: `app/(app)/toube/planos/SourceInput.tsx`
- Modify: `app/(app)/toube/page.tsx` (link "Montar um plano" → `/toube/planos`)

**Interfaces:**
- Consumes: `getOrCreateDraft`, `criarProgramaCompleto`, `novoRascunho` de `./actions`; `Plan` de `@/lib/planos-draft`.
- Produces: rota renderizada `/toube/planos`.

- [ ] **Step 1: `PlanPreview.tsx` (renderiza o plano vivo)**

```tsx
"use client";
import type { Plan } from "@/lib/planos-draft";

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function PlanPreview({ plan }: { plan: Plan }) {
  if (!plan.days.length) {
    return (
      <p className="p-4 text-sm" style={{ color: "var(--color-fg-muted)" }}>
        O plano aparece aqui conforme você e o Toube montam. Manda um "monta um ABC 3x" ou cola um link/PDF.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3 p-1">
      <h2 className="text-base font-semibold" style={{ color: "var(--color-fg)" }}>
        {plan.name || "Plano sem nome"}
      </h2>
      {plan.days.map((d, i) => (
        <div
          key={`${d.weekday}-${i}`}
          className="rounded-xl border p-3"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--color-accent)" }}>
            {WD[d.weekday]} · {d.name}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {d.exercises.map((e, j) => (
              <li key={`${e.name}-${j}`} className="text-sm" style={{ color: "var(--color-fg)" }}>
                {e.name}
                {e.target_sets ? (
                  <span style={{ color: "var(--color-fg-muted)" }}>
                    {" "}
                    — {e.target_sets}×{e.reps_low ?? "?"}-{e.reps_high ?? "?"}
                  </span>
                ) : null}
              </li>
            ))}
            {!d.exercises.length ? (
              <li className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
                (sem exercícios ainda)
              </li>
            ) : null}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `SourceInput.tsx` (colar URL / anexar PDF)**

```tsx
"use client";
import { useRef, useState } from "react";
import type { Plan } from "@/lib/planos-draft";

export function SourceInput({ onResult }: { onResult: (reply: string, plan: Plan) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  async function sendUrl() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setErr(undefined);
    try {
      const res = await fetch("/api/toube/planos/fonte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha na fonte.");
      setUrl("");
      onResult(data.reply, data.plan);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  async function sendPdf(file: File) {
    setBusy(true);
    setErr(undefined);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/toube/planos/fonte", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no PDF.");
      onResult(data.reply, data.plan);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Cola um link do YouTube ou site…"
          className="flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none"
          style={{ borderColor: "var(--color-border)", color: "var(--color-fg)" }}
        />
        <button type="button" onClick={sendUrl} disabled={busy || !url.trim()} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40" style={{ background: "var(--gradient-brand)" }}>
          {busy ? "…" : "Usar"}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40" style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}>
          PDF
        </button>
        <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && sendPdf(e.target.files[0])} />
      </div>
      {err ? (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {err}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: `PlanosChat.tsx` (chat + orquestra preview + commit)**

Espelhe `app/(app)/toube/ToubeChat.tsx` (mesmo visual de bolhas/input), mas: (a) mantém `plan` em estado; (b) manda mensagens pra `/api/toube/planos`; (c) inclui `<SourceInput>` no topo e `<PlanPreview plan={plan}>` num painel; (d) botão "Criar programa completo" que chama a action.

```tsx
"use client";
import { criarProgramaCompleto } from "./actions";
import { PlanPreview } from "./PlanPreview";
import { SourceInput } from "./SourceInput";
import type { Plan } from "@/lib/planos-draft";
import { type KeyboardEvent, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export function PlanosChat({ initialPlan }: { initialPlan: Plan }) {
  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [done, setDone] = useState<string>();
  const [error, setError] = useState<string>();

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(undefined);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await fetch("/api/toube/planos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro.");
      setPlan(data.plan);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro.");
    } finally {
      setSending(false);
    }
  }

  function onSource(reply: string, p: Plan) {
    setPlan(p);
    setMessages((m) => [...m, { role: "assistant", content: reply }]);
  }

  async function commit() {
    if (committing) return;
    setCommitting(true);
    setError(undefined);
    try {
      const res = await criarProgramaCompleto();
      if (res.error) throw new Error(res.error);
      setDone("✓ Programa criado! Já está no módulo Treino.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar.");
    } finally {
      setCommitting(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const bubble = "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed";

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-2">
      {/* Painel do plano vivo */}
      <div className="order-1 md:order-2">
        <div className="rounded-2xl border p-2" style={{ borderColor: "var(--color-border)", background: "var(--color-bg-elevated)" }}>
          <PlanPreview plan={plan} />
        </div>
        {plan.days.length ? (
          <button type="button" onClick={commit} disabled={committing} className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--gradient-brand)" }}>
            {committing ? "Criando…" : "Criar programa completo"}
          </button>
        ) : null}
        {done ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-fg-muted)" }}>
            {done}
          </p>
        ) : null}
      </div>

      {/* Chat */}
      <div className="order-2 flex flex-col gap-3 md:order-1">
        <SourceInput onResult={onSource} />
        <div className="flex flex-col gap-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={bubble}
              style={
                m.role === "user"
                  ? { alignSelf: "flex-end", background: "var(--gradient-brand)", color: "#fff" }
                  : { alignSelf: "flex-start", background: "var(--color-card)", color: "var(--color-fg)", border: "1px solid var(--color-border)" }
              }
            >
              {m.content}
            </div>
          ))}
          {sending ? (
            <div className={`${bubble} self-start`} style={{ background: "var(--color-card)", color: "var(--color-fg-muted)", border: "1px solid var(--color-border)" }}>
              Montando…
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="text-xs" style={{ color: "var(--color-danger)" }}>
            {error}
          </p>
        ) : null}
        <div className="sticky bottom-4 flex items-end gap-2 rounded-2xl p-2" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} rows={1} placeholder="Fala como quer o treino…" className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none" style={{ color: "var(--color-fg)" }} />
          <button type="button" onClick={send} disabled={sending || !input.trim()} className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: "var(--gradient-brand)" }}>
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
```

Nota de biome: a key `key={i}` por índice pode gerar warning `noArrayIndexKey`. Se `pnpm check` reclamar, troque por `key={`${m.role}-${i}`}` (mensagens só crescem no fim, então é seguro) ou adicione o `// biome-ignore` no padrão do ToubeChat.

- [ ] **Step 4: `page.tsx` (server component)**

```tsx
import { getOrCreateDraft } from "./actions";
import { PlanosChat } from "./PlanosChat";

export default async function PlanosPage() {
  const { plan } = await getOrCreateDraft();
  return (
    <div className="px-4 py-6">
      <h1 className="mb-4 text-center text-lg font-semibold" style={{ color: "var(--color-fg)" }}>
        Toube Planos — monta seu treino
      </h1>
      <PlanosChat initialPlan={plan} />
    </div>
  );
}
```

- [ ] **Step 5: Link a partir do Toube**

Em `app/(app)/toube/page.tsx`, adicione um link discreto pro `/toube/planos` (ex.: um botão/chip "🏋️ Montar um plano de treino" perto do topo). Siga o estilo do arquivo. Exemplo mínimo (ajuste ao layout real):
```tsx
import Link from "next/link";
// … dentro do JSX, perto do topo:
<Link href="/toube/planos" className="mx-auto mb-4 block w-fit rounded-full border px-4 py-1.5 text-sm font-medium" style={{ borderColor: "var(--color-border)", color: "var(--color-accent)" }}>
  🏋️ Montar um plano de treino
</Link>
```

- [ ] **Step 6: Portão completo**

Run: `pnpm exec tsc --noEmit && pnpm check && pnpm build`
Expected: tsc 0, biome limpo, build "Compiled successfully".

- [ ] **Step 7: E2E manual (dev server)**

Run: `pnpm dev` e abra `http://localhost:3007/toube/planos`. Fluxo:
1. "monta um ABC de hipertrofia 3x" → plano vivo aparece à direita.
2. "tira o dia de perna" / "põe rosca direta no dia 0" → preview atualiza.
3. (Opcional) cola um link do YouTube com legenda → monta do zero a partir dele.
4. "Criar programa completo" → confirma. Vá em `/treino` e veja o programa + dias + exercícios criados.
5. Cheque no banco (service_role) que o rascunho virou `status='committed'` com `created_program_id` preenchido.

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/toube/planos/page.tsx" "app/(app)/toube/planos/PlanosChat.tsx" "app/(app)/toube/planos/PlanPreview.tsx" "app/(app)/toube/planos/SourceInput.tsx" "app/(app)/toube/page.tsx"
git commit -m "feat(planos): UI — página, chat, plano vivo, fonte e commit"
```

---

### Task 8: Fechamento — memória + roadmap

**Files:**
- Modify: `memory/toube-agente-roadmap.md` (marcar Fase 6 entregue)

- [ ] **Step 1: Atualizar a memória do roadmap** marcando Fase 6 (Toube Planos) como entregue, com o commit final, o schema `workout_program_drafts`, o uso do Groq e o caveat do transcript de YouTube. (Arquivo em `/home/atomossoulucaoegestao/.claude/projects/-home-atomossoulucaoegestao-Vile-Foco-Projetosjm-Touvie/memory/toube-agente-roadmap.md`.)

- [ ] **Step 2: Commit final** (se houver mudança rastreada no repo; a memória fica fora do repo)

```bash
git log --oneline -8
```
Confirme a sequência de commits da Fase 6.

---

## Self-Review (feito pelo autor do plano)

**Cobertura do spec:**
- Onde vive/UI → Task 7. ✅
- `workout_program_drafts` + contrato do plan → Task 1 + Task 2. ✅
- Groq adapter + tools que mutam rascunho (aplicação imediata) → Task 3 + Task 5. ✅
- Ingestão link/YouTube/PDF (com caveat) → Task 6. ✅
- Commit único com rollback, não ativa programa → Task 4. ✅
- Erros tratados (fonte, Groq, mutação inválida, rascunho vazio) → Tasks 2/4/5/6. ✅
- Env GROQ_API_KEY documentado → Task 3. ✅
- Portão (tsc+biome+build+smoke/E2E) → cada task. ✅

**Consistência de tipos:** `Plan/PlanDay/PlanExercise` definidos na Task 2 e usados igual em 3/4/5/6/7. `applyMutation(plan, tool, args)`, `planosReply(history, plan, sourceText?)`, `getOrCreateDraft()→{id,plan}`, `saveDraftPlan(id,plan)`, `criarProgramaCompleto()→{ok,error,programId}` — assinaturas batem entre as tasks que produzem e consomem.

**Placeholders:** nenhum "TBD/TODO"; código real em cada passo. O único ponto de "ajuste ao layout real" (link no `/toube/page.tsx`, Task 7 Step 5) é intencional — depende do JSX existente, com exemplo concreto dado.
