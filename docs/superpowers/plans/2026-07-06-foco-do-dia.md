# Foco do dia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overlay opt-in de "Foco do dia" — 1×/dia o usuário registra um foco, ele flutua na lateral, e ao finalizar o app parabeniza com a duração.

**Architecture:** Tabela `focus_quests` (own-row RLS) + flag `focus_quest_enabled` em `profiles`. Um overlay client (`FocusQuest.tsx`) montado no layout `(app)` quando a flag está ligada; máquina de 3 estados (convite → ativa → concluída). Server actions via RLS (sem service_role) pra criar/finalizar/descartar. Conteúdo (autoafirmações/perguntas/parabéns) em `messages/` pt+en, sorteado no client.

**Tech Stack:** Next.js 15 (App Router, Server Components/Actions), Supabase (RLS), next-intl, date-fns-tz, Tailwind v4, Biome.

## Global Constraints

- **Gerenciador:** `pnpm` (nunca npm/yarn). Dev na porta **3007**.
- **Sem suíte de testes automatizados.** Portão de qualidade por task: `pnpm check` (Biome autofix) + `pnpm exec tsc --noEmit`. Task de conteúdo roda também `pnpm check:i18n`. Task final roda `pnpm build` + QA manual no navegador.
- **Cliente Supabase por contexto:** `server.ts` em Server Components/Actions (respeita RLS). **Nunca** `admin.ts` em código que chega ao browser.
- **Textos visíveis → `messages/` (pt-BR + en)**, nunca hardcoded no JSX.
- **CSS sempre via `cn(...)`**; ícones `lucide-react`; animação de entrada via `<Reveal>` + tokens `--ease-*`.
- **Fuso:** "hoje" é sempre **BRT** (`America/Sao_Paulo`, sem DST desde 2019), via helpers de `lib/datetime.ts`.
- **Migrations rodam à mão** no SQL Editor do Supabase, em ordem numérica. A `0025` **precisa ser aplicada** antes da feature funcionar (o código degrada em silêncio se ela não rodou).
- **Server Actions retornam** `{ ok: boolean; ...; error?: string }` (padrão de `components/reminders/actions.ts`).

---

## Task 1: Fundação de dados — migração 0025, helper de fuso e tipos

**Files:**
- Create: `supabase/migrations/0025_focus_quests.sql`
- Modify: `lib/datetime.ts` (import + novo helper no fim)
- Modify: `lib/supabase/types.ts` (nova tabela + coluna em `profiles`, ~linha 47 e ~54)

**Interfaces:**
- Produces: `startOfTodayBRTUTC(): string` (ISO UTC da meia-noite BRT de hoje).
- Produces: tipos `Database["public"]["Tables"]["focus_quests"]` e `profiles.focus_quest_enabled: boolean`.

- [ ] **Step 1: Escrever a migração** `supabase/migrations/0025_focus_quests.sql`:

```sql
-- =====================================================================
-- Foco do dia — quest diária opt-in. Uma linha por quest criada.
-- =====================================================================
-- RLS own-row (espelha touvi_messages/user_reminders). update = finalizar
-- (seta completed_at); delete = descartar. Rodar no SQL Editor do Supabase.
create table public.focus_quests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  text         text not null,
  prompt       text not null,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.focus_quests enable row level security;
create index focus_quests_user_idx on public.focus_quests(user_id, started_at);

create policy "own select" on public.focus_quests for select using (auth.uid() = user_id);
create policy "own insert" on public.focus_quests for insert with check (auth.uid() = user_id);
create policy "own update" on public.focus_quests for update using (auth.uid() = user_id);
create policy "own delete" on public.focus_quests for delete using (auth.uid() = user_id);

-- Preferência opt-in da feature (default desligado).
alter table public.profiles
  add column focus_quest_enabled boolean not null default false;
```

- [ ] **Step 2: Adicionar o helper de fuso** em `lib/datetime.ts`. Trocar a linha 2 de import e adicionar a função após `todayBRTISO` (~linha 32):

```ts
// linha 2 — adicionar fromZonedTime ao import existente:
import { fromZonedTime, toZonedTime } from "date-fns-tz";

// adicionar após todayBRTISO():
/** Meia-noite BRT de hoje como instante UTC (ISO). Base do filtro "quest de hoje". */
export function startOfTodayBRTUTC(): string {
  return fromZonedTime(`${todayBRTISO()}T00:00:00`, TZ).toISOString();
}
```

- [ ] **Step 3: Tipar no `lib/supabase/types.ts`.** Adicionar `focus_quest_enabled` à Row de `profiles` (após `locale: string;`, ~linha 44):

```ts
        locale: string;
        focus_quest_enabled: boolean;
```

E adicionar a tabela nova logo após o bloco `touvi_messages` (~linha 54):

```ts
      focus_quests: Table<{
        id: string;
        user_id: string;
        text: string;
        prompt: string;
        started_at: Timestamptz;
        completed_at: Timestamptz | null;
        created_at: Timestamptz;
      }>;
```

- [ ] **Step 4: Rodar o portão de qualidade.**

Run: `pnpm check && pnpm exec tsc --noEmit`
Expected: sem erros. (A migração é SQL puro — não afeta o typecheck; será aplicada à mão no Supabase antes do teste manual da Task 7.)

- [ ] **Step 5: Commit.**

```bash
git add supabase/migrations/0025_focus_quests.sql lib/datetime.ts lib/supabase/types.ts
git commit -m "feat(foco): migração 0025 + tipos e helper de fuso do Foco do dia

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Conteúdo i18n (`focoDoDia`) pt + en

**Files:**
- Modify: `messages/pt-BR.json` (novo namespace `focoDoDia`)
- Modify: `messages/en.json` (mesmo namespace, chaves paritárias)

**Interfaces:**
- Produces: `focoDoDia.title`, `.enabledLabel`, `.disabledLabel`, `.configTitle`, `.configDesc`, `.create`, `.finish`, `.discard`, `.placeholder`, e as listas `.affirmations` (array), `.questions` (array), `.congrats` (array, com `{duration}`).

- [ ] **Step 1: Adicionar o namespace em `messages/pt-BR.json`** (como uma chave de topo, ao lado das outras). Banco inicial — o usuário poda depois:

```json
  "focoDoDia": {
    "title": "Foco do dia",
    "create": "Definir foco",
    "finish": "Finalizar",
    "discard": "Descartar",
    "placeholder": "Escreva seu foco de hoje…",
    "configTitle": "Foco do dia",
    "configDesc": "Ao abrir o app, uma nota sutil convida você a definir um foco pro dia — e comemora quando você conclui.",
    "enabledLabel": "Ligado",
    "disabledLabel": "Desligado",
    "affirmations": [
      "Você já está aqui — isso é começar.",
      "Um passo de cada vez constrói qualquer caminho.",
      "O que você cuida hoje, agradece amanhã.",
      "Pequeno e feito vale mais que grande e adiado.",
      "Sua atenção é o recurso mais valioso que você tem.",
      "Hoje é uma folha em branco — escreva algo bom nela.",
      "Progresso, não perfeição.",
      "Você é mais capaz do que a pressa deixa você lembrar.",
      "Foco é dizer 'não' pra dez coisas boas por uma essencial.",
      "Comece pelo que importa; o resto se acomoda.",
      "Cada dia é uma chance nova de se aproximar de quem você quer ser.",
      "O futuro que você quer nasce das escolhas de hoje.",
      "Respire. Escolha uma coisa. Faça bem feito.",
      "Consistência silenciosa vence entusiasmo barulhento.",
      "Você não precisa fazer tudo — só a próxima coisa certa.",
      "Confie no processo: você já chegou longe."
    ],
    "questions": [
      "O que você quer fazer hoje?",
      "Qual é o seu foco agora?",
      "No que você quer colocar sua energia hoje?",
      "Qual seria uma vitória pra hoje?",
      "O que, se feito hoje, deixaria o dia bom?",
      "Onde sua atenção faz mais diferença agora?",
      "Qual o seu norte pra hoje?"
    ],
    "congrats": [
      "Feito! Levou {duration} — uma fração do caminho rumo ao seu futuro.",
      "Concluído em {duration}. É assim que se constrói uma vida melhor: um foco de cada vez.",
      "Mandou bem! {duration} bem investidos em quem você está se tornando.",
      "Pronto — {duration} pra sair do 'pensar' e entrar no 'fiz'.",
      "Que orgulho! {duration} de foco real. Isso soma.",
      "Concluído em {duration}. Pequenas vitórias, grandes trajetórias.",
      "Feito em {duration}. Amanhã o seu 'eu' vai agradecer.",
      "{duration} de dedicação — e mais um tijolo no seu caminho.",
      "Isso! {duration} transformados em progresso de verdade.",
      "Concluído em {duration}. Você honrou o que se propôs hoje."
    ]
  }
```

- [ ] **Step 2: Adicionar o MESMO namespace em `messages/en.json`** (mesmas chaves, mesmos tamanhos de array):

```json
  "focoDoDia": {
    "title": "Today's focus",
    "create": "Set focus",
    "finish": "Finish",
    "discard": "Discard",
    "placeholder": "Write your focus for today…",
    "configTitle": "Today's focus",
    "configDesc": "When you open the app, a subtle note invites you to set a focus for the day — and celebrates when you finish it.",
    "enabledLabel": "On",
    "disabledLabel": "Off",
    "affirmations": [
      "You're already here — that's starting.",
      "One step at a time builds any road.",
      "What you tend to today, you thank tomorrow.",
      "Small and done beats big and postponed.",
      "Your attention is the most valuable resource you have.",
      "Today is a blank page — write something good on it.",
      "Progress, not perfection.",
      "You're more capable than the rush lets you remember.",
      "Focus is saying 'no' to ten good things for one essential one.",
      "Start with what matters; the rest settles.",
      "Every day is a fresh chance to get closer to who you want to be.",
      "The future you want is born from today's choices.",
      "Breathe. Pick one thing. Do it well.",
      "Quiet consistency beats noisy enthusiasm.",
      "You don't have to do everything — just the next right thing.",
      "Trust the process: you've already come far."
    ],
    "questions": [
      "What do you want to do today?",
      "What's your focus right now?",
      "Where do you want to put your energy today?",
      "What would count as a win today?",
      "What, if done today, would make the day good?",
      "Where does your attention matter most right now?",
      "What's your north star for today?"
    ],
    "congrats": [
      "Done! It took {duration} — a fraction of the path toward your future.",
      "Finished in {duration}. This is how a better life is built: one focus at a time.",
      "Nicely done! {duration} well spent on who you're becoming.",
      "Done — {duration} to move from 'thinking' to 'did it'.",
      "Proud of you! {duration} of real focus. It adds up.",
      "Finished in {duration}. Small wins, big trajectories.",
      "Done in {duration}. Tomorrow's you will thank you.",
      "{duration} of dedication — another brick on your path.",
      "That's it! {duration} turned into real progress.",
      "Finished in {duration}. You honored what you set out to do today."
    ]
  }
```

- [ ] **Step 3: Rodar paridade de chaves + portão.**

Run: `pnpm check:i18n && pnpm check`
Expected: `✓ ... chaves paritárias` e Biome sem erros.

- [ ] **Step 4: Commit.**

```bash
git add messages/pt-BR.json messages/en.json
git commit -m "feat(foco): banco de conteúdo i18n do Foco do dia (pt+en)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Server actions (`components/focus-quest/actions.ts`)

**Files:**
- Create: `components/focus-quest/actions.ts`

**Interfaces:**
- Consumes: `startOfTodayBRTUTC` (Task 1), `createClient` de `@/lib/supabase/server`.
- Produces:
  - `type QuestRow = { id: string; text: string; prompt: string; started_at: string; completed_at: string | null }`
  - `todayQuest(): Promise<QuestRow | null>` (leitura server-side p/ o layout)
  - `createQuest(text: string, prompt: string): Promise<{ ok: boolean; quest?: QuestRow; error?: string }>`
  - `completeQuest(id: string): Promise<{ ok: boolean; quest?: QuestRow; error?: string }>`
  - `discardQuest(id: string): Promise<{ ok: boolean; error?: string }>`
  - `setFocusQuestEnabled(enabled: boolean): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Escrever o arquivo completo** `components/focus-quest/actions.ts`:

```ts
"use server";

import { startOfTodayBRTUTC } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export type QuestRow = {
  id: string;
  text: string;
  prompt: string;
  started_at: string;
  completed_at: string | null;
};

const COLS = "id, text, prompt, started_at, completed_at";
const MAX_LEN = 280;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, userId: user.id };
}

/** Quest do usuário cujo started_at cai no dia BRT de hoje (a mais recente). */
export async function todayQuest(): Promise<QuestRow | null> {
  try {
    const { supabase, userId } = await requireUser();
    const { data } = await supabase
      .from("focus_quests")
      .select(COLS)
      .eq("user_id", userId)
      .gte("started_at", startOfTodayBRTUTC())
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as QuestRow | null) ?? null;
  } catch {
    return null;
  }
}

export async function createQuest(
  text: string,
  prompt: string,
): Promise<{ ok: boolean; quest?: QuestRow; error?: string }> {
  const clean = text.trim();
  if (!clean) return { ok: false, error: "Escreva seu foco primeiro." };
  if (clean.length > MAX_LEN) return { ok: false, error: "Foco muito longo." };
  try {
    const { supabase, userId } = await requireUser();

    // Guarda anti-duplicata: se já há quest hoje, devolve a existente.
    const existing = await todayQuest();
    if (existing) return { ok: true, quest: existing };

    const { data, error } = await supabase
      .from("focus_quests")
      .insert({ user_id: userId, text: clean, prompt })
      .select(COLS)
      .single();
    if (error) {
      return {
        ok: false,
        error: error.message.includes("focus_quests")
          ? "Aplique a migração 0025 no Supabase primeiro."
          : error.message,
      };
    }
    return { ok: true, quest: data as QuestRow };
  } catch {
    return { ok: false, error: "Não consegui salvar." };
  }
}

export async function completeQuest(
  id: string,
): Promise<{ ok: boolean; quest?: QuestRow; error?: string }> {
  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from("focus_quests")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .is("completed_at", null)
      .select(COLS)
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, quest: data as QuestRow };
  } catch {
    return { ok: false, error: "Falhou." };
  }
}

export async function discardQuest(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("focus_quests")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Falhou." };
  }
}

export async function setFocusQuestEnabled(
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("profiles")
      .update({ focus_quest_enabled: enabled })
      .eq("id", userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Falhou." };
  }
}
```

- [ ] **Step 2: Rodar o portão.**

Run: `pnpm check && pnpm exec tsc --noEmit`
Expected: sem erros (os nomes de tabela/coluna batem com os tipos da Task 1).

- [ ] **Step 3: Commit.**

```bash
git add components/focus-quest/actions.ts
git commit -m "feat(foco): server actions criar/finalizar/descartar + toggle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Overlay `FocusQuest.tsx`

**Files:**
- Create: `components/focus-quest/FocusQuest.tsx`

**Interfaces:**
- Consumes: `QuestRow`, `createQuest`, `completeQuest`, `discardQuest` (Task 3); `useTranslations` do next-intl; `cn` de `@/lib/utils`; `<Reveal>`.
- Produces: `export function FocusQuest({ initial }: { initial: QuestRow | null }): JSX.Element` (default export não; nomeado, padrão do repo).

- [ ] **Step 1: Escrever o componente** `components/focus-quest/FocusQuest.tsx`:

```tsx
"use client";

import { type QuestRow, completeQuest, createQuest, discardQuest } from "@/components/focus-quest/actions";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

/** Sorteia um item estável (só muda quando `seed` muda). */
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/** Duração "amigável" entre dois ISO. Skew negativo → "agora". */
function formatDuration(startISO: string, endISO: string): string {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export function FocusQuest({ initial }: { initial: QuestRow | null }) {
  const t = useTranslations("focoDoDia");
  const [quest, setQuest] = useState<QuestRow | null>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Sorteio estável por montagem (Math.random é aceitável no client).
  const seed = useMemo(() => Math.floor(Math.random() * 1000), []);
  const affirmations = t.raw("affirmations") as string[];
  const questions = t.raw("questions") as string[];
  const congrats = t.raw("congrats") as string[];
  const affirmation = pick(affirmations, seed);
  const question = pick(questions, seed);

  if (dismissed) return null;

  const phase = !quest ? "invite" : quest.completed_at ? "done" : "active";

  async function onCreate() {
    if (!text.trim() || busy) return;
    setBusy(true);
    const res = await createQuest(text, question);
    setBusy(false);
    if (res.ok && res.quest) {
      setQuest(res.quest);
      setText("");
    }
  }

  async function onFinish() {
    if (!quest || busy) return;
    setBusy(true);
    const res = await completeQuest(quest.id);
    setBusy(false);
    if (res.ok && res.quest) setQuest(res.quest);
  }

  async function onDiscard() {
    if (!quest || busy) return;
    setBusy(true);
    const res = await discardQuest(quest.id);
    setBusy(false);
    if (res.ok) setQuest(null); // volta ao convite
  }

  return (
    <aside
      className={cn(
        "fixed bottom-24 right-4 z-40 w-[min(20rem,calc(100vw-2rem))]",
        "rounded-2xl border p-4 shadow-lg backdrop-blur",
      )}
      style={{
        background: "color-mix(in srgb, var(--color-card) 82%, transparent)",
        borderColor: "var(--color-border)",
      }}
    >
      {phase === "invite" && (
        <div className="grid gap-3">
          <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
            {affirmation}
          </p>
          <p className="font-semibold">{question}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder={t("placeholder")}
            className="w-full resize-none rounded-lg border bg-transparent p-2 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
          <button
            type="button"
            onClick={onCreate}
            disabled={busy || !text.trim()}
            className="rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
          >
            {t("create")}
          </button>
        </div>
      )}

      {phase === "active" && quest && (
        <div className="grid gap-3">
          <p className="text-xs uppercase tracking-wide" style={{ color: "var(--color-fg-muted)" }}>
            {t("title")}
          </p>
          <p className="font-semibold">{quest.text}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFinish}
              disabled={busy}
              className="rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50"
              style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
            >
              {t("finish")}
            </button>
            <button
              type="button"
              onClick={onDiscard}
              disabled={busy}
              className="text-xs underline opacity-70 transition hover:opacity-100"
            >
              {t("discard")}
            </button>
          </div>
        </div>
      )}

      {phase === "done" && quest?.completed_at && (
        <div className="grid gap-3">
          <p className="text-sm font-medium">
            {pick(congrats, seed).replace(
              "{duration}",
              formatDuration(quest.started_at, quest.completed_at),
            )}
          </p>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="justify-self-start text-xs underline opacity-70 transition hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Rodar o portão.**

Run: `pnpm check && pnpm exec tsc --noEmit`
Expected: sem erros. (`t.raw` retorna `unknown` → o cast `as string[]` é intencional e passa no Biome; se acusar `any`, mantém o cast explícito.)

- [ ] **Step 3: Commit.**

```bash
git add components/focus-quest/FocusQuest.tsx
git commit -m "feat(foco): overlay FocusQuest (convite → ativa → concluída)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Montar o overlay no layout `(app)`

**Files:**
- Modify: `app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `FocusQuest` (Task 4), `startOfTodayBRTUTC` (Task 1), o `createClient`/`user` já existentes no layout.

- [ ] **Step 1: Editar `app/(app)/layout.tsx`.** Adicionar os imports no topo:

```ts
import { FocusQuest } from "@/components/focus-quest/FocusQuest";
import { startOfTodayBRTUTC } from "@/lib/datetime";
```

Após o guard `if (!user) redirect("/login");`, buscar a preferência e a quest de hoje (isolado, degrada em silêncio se a 0025 não rodou):

```ts
  // Foco do dia (opt-in). Query isolada: se a coluna/tabela não existir
  // (migração 0025 pendente), a feature simplesmente não aparece.
  const focusEnabled = await supabase
    .from("profiles")
    .select("focus_quest_enabled")
    .eq("id", user.id)
    .maybeSingle()
    .then((r) => r.data?.focus_quest_enabled ?? false)
    .catch(() => false);

  let todayQuest = null;
  if (focusEnabled) {
    todayQuest = await supabase
      .from("focus_quests")
      .select("id, text, prompt, started_at, completed_at")
      .eq("user_id", user.id)
      .gte("started_at", startOfTodayBRTUTC())
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => r.data ?? null)
      .catch(() => null);
  }
```

E montar o overlay dentro do `<div className="flex min-h-screen flex-col">`, ao lado de `<SoundscapeLayer />`:

```tsx
      {focusEnabled && <FocusQuest initial={todayQuest} />}
```

- [ ] **Step 2: Rodar o portão.**

Run: `pnpm check && pnpm exec tsc --noEmit`
Expected: sem erros. O tipo de `todayQuest` casa com `QuestRow | null` (mesmas colunas na mesma ordem).

- [ ] **Step 3: Commit.**

```bash
git add "app/(app)/layout.tsx"
git commit -m "feat(foco): monta o overlay Foco do dia no layout logado

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Toggle no `/config`

**Files:**
- Create: `app/(app)/config/FocusQuestToggle.tsx`
- Modify: `app/(app)/config/page.tsx` (query + card novo)

**Interfaces:**
- Consumes: `setFocusQuestEnabled` (Task 3); padrão visual de `StarsToggle`/`CardHead`/`Reveal`.

- [ ] **Step 1: Criar `app/(app)/config/FocusQuestToggle.tsx`** (espelha o StarsToggle, mas persiste no banco):

```tsx
"use client";

import { setFocusQuestEnabled } from "@/components/focus-quest/actions";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function FocusQuestToggle({ initial }: { initial: boolean }) {
  const t = useTranslations("focoDoDia");
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function pick(value: boolean) {
    if (busy || value === on) return;
    setOn(value);
    setBusy(true);
    const res = await setFocusQuestEnabled(value);
    setBusy(false);
    if (!res.ok) setOn(!value); // reverte se falhou
  }

  const options = [
    { on: true, label: t("enabledLabel") },
    { on: false, label: t("disabledLabel") },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((o) => (
        <button
          type="button"
          key={o.label}
          onClick={() => pick(o.on)}
          disabled={busy}
          className={cn(
            "rounded-lg border p-3 text-left transition disabled:opacity-60",
            on === o.on ? "ring-2" : "hover:opacity-90",
          )}
          style={{
            background: "var(--color-card)",
            borderColor: on === o.on ? "var(--color-accent)" : "var(--color-border)",
            // @ts-expect-error ring-color custom property
            "--tw-ring-color": "var(--color-accent)",
          }}
        >
          <span className="font-semibold">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Ler a preferência no `app/(app)/config/page.tsx`.** Adicionar uma query isolada ao `Promise.all` (junto das outras `profiles`, ~linha 60), seguindo o padrão de degradação:

```ts
    // Foco do dia — isolado: 0025 pode não ter rodado.
    supabase
      .from("profiles")
      .select("focus_quest_enabled")
      .eq("id", user!.id)
      .maybeSingle()
      .then((r) => r.data),
```

Ajustar o destructuring do `Promise.all` pra receber esse novo resultado (ex.: `const [profile, names, writePin, focusPref, locale] = await Promise.all([...])`) — inserindo a query **na mesma posição** do array. Derivar: `const focusEnabled = focusPref?.focus_quest_enabled ?? false;`

- [ ] **Step 3: Renderizar o card** no JSX do `page.tsx`, junto dos outros toggles (ex.: perto do `StarsToggle`), importando os componentes no topo:

```tsx
import { FocusQuestToggle } from "./FocusQuestToggle";
import { Target } from "lucide-react"; // adicionar à lista de imports de lucide-react
```

```tsx
        <Reveal style={{ transitionDelay: `${STAGGER_MS * N}ms` }}>
          <FoldCard>
            <CardHead icon={Target} title={t("configTitle")} desc={t("configDesc")} />
            <FocusQuestToggle initial={focusEnabled} />
          </FoldCard>
        </Reveal>
```

(Ajustar `N` pro índice de stagger do card na sequência; usar o mesmo `useTranslations("focoDoDia")` — no page.tsx server component, obter `t` como os outros textos já fazem. Se o page usa `getTranslations`, seguir o mesmo mecanismo já presente no arquivo.)

- [ ] **Step 4: Rodar o portão.**

Run: `pnpm check && pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit.**

```bash
git add "app/(app)/config/FocusQuestToggle.tsx" "app/(app)/config/page.tsx"
git commit -m "feat(foco): card de ligar/desligar o Foco do dia no /config

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Portão final + QA manual

**Files:** nenhum (validação).

- [ ] **Step 1: Aplicar a migração 0025** no SQL Editor do Supabase (copiar o SQL da Task 1). Confirmar: `select focus_quest_enabled from profiles limit 1;` retorna sem erro e `\d focus_quests` mostra as 4 policies.

- [ ] **Step 2: Build de produção.**

Run: `pnpm build`
Expected: build verde, sem erro de tipo/rota.

- [ ] **Step 3: QA manual** (`pnpm dev`, http://localhost:3007):
  - `/config` → card "Foco do dia" → **Ligar**.
  - Recarregar o app logado → overlay de **convite** aparece com autoafirmação + pergunta.
  - Escrever um foco → **Definir foco** → vira quest **ativa** flutuando.
  - Recarregar → continua ativa (persistiu). Abrir em outra aba → mesma quest (sem duplicar).
  - **Finalizar** → parabéns com duração formatada. Fechar (✕) → some.
  - Recriar, **Descartar** → volta ao convite.
  - `/config` → **Desligar** → recarregar → overlay não aparece.
  - Trocar idioma pra EN → textos do overlay/config em inglês.

- [ ] **Step 4: Atualizar docs.** Marcar Quests como feito no `ROADMAP.md` (mover de "Pós-launch" pra "Feito") e trocar o status do `Quests.md` de "planejado" pra "IMPLEMENTADO (jul/2026) — ver `docs/superpowers/specs/2026-07-06-foco-do-dia-design.md`". Commit:

```bash
git add ROADMAP.md Quests.md
git commit -m "docs: Foco do dia implementado — atualiza ROADMAP e Quests.md

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notas de execução

- **Ordem:** Task 1 → 7 é a ordem de dependência (dados → conteúdo → actions → UI → wiring → config → QA). Tasks 2 e 3 são independentes entre si (podem ir em paralelo se executadas por subagentes), mas ambas dependem da Task 1.
- **Sem service_role** em nenhum ponto — tudo via `server.ts` + RLS.
- **`t.raw()`** é a forma do next-intl de ler arrays; retorna `unknown`, daí o cast explícito para `string[]`.
