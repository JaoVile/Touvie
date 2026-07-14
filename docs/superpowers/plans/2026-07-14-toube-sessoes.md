# Toube — Sessões de Conversa (+ colar imagem) — Plano

> **Execução INLINE** nesta sessão (controller). Portão por etapa: `pnpm exec tsc --noEmit`
> + `pnpm check` + `pnpm build` (quando toca rota/UI) + smoke Node (`node --import
> ./scripts/dev-alias.mjs <s>.ts`) / E2E via service_role. Sem testes automatizados.
> Spec: `docs/superpowers/specs/2026-07-14-toube-sessoes-design.md`.

**Goal:** conversa do Toube separada em SESSÕES (lista/reabrir/renomear/apagar); o modelo lê
só a sessão atual (anti-alucinação). Bônus: colar imagem (Ctrl+V) no chat.

**Architecture:** `toube_sessions` (1:N `toube_messages` via `session_id`). Route POST/GET
session-scoped + auto-título. Página `/toube` com sidebar de conversas; painel flutuante com
lista. `ToubeConversation` (compartilhado) vira session-aware + `onPaste` de imagem reusando a
rota de anexo (Scout visão) que já existe.

**Tech Stack:** Next.js 15 App Router, Supabase (RLS), Groq (Scout visão, já existe), pnpm.

## Global Constraints

- pnpm; porta 3007. NO test framework — gate = tsc + biome + build + smoke/E2E.
- Migrations rodam MANUAL no SQL Editor (o plano cria o `.sql`; o usuário roda).
- PT hardcoded no módulo Toube (padrão local, ver ToubeConversation). Ícones lucide-react.
- Supabase server client `@/lib/supabase/server` (RLS). Nada de admin no browser.
- **Diário intocável** — nada aqui toca `journal_entries`.
- Insert/Update em `types.ts` são `Partial<Row>` → tsc NÃO pega coluna errada em insert; conferir contra schema real.

---

### Task 1: Migration 0030 + types

**Files:**
- Create: `supabase/migrations/0030_toube_sessions.sql`
- Modify: `lib/supabase/types.ts`

**Interfaces:**
- Produces: tabela `toube_sessions` (id, user_id, title|null, created_at, updated_at) e
  coluna `toube_messages.session_id uuid not null`.

- [ ] **Step 1: Migration**
```sql
-- Sessões de conversa do Toube (estilo ChatGPT). Cada mensagem pertence a uma sessão;
-- o modelo passa a ler só a sessão atual (anti-alucinação por acúmulo).
create table public.toube_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.toube_sessions enable row level security;
create index toube_sessions_user_idx on public.toube_sessions(user_id, updated_at desc);
create policy "own select" on public.toube_sessions for select using (auth.uid() = user_id);
create policy "own insert" on public.toube_sessions for insert with check (auth.uid() = user_id);
create policy "own update" on public.toube_sessions for update using (auth.uid() = user_id);
create policy "own delete" on public.toube_sessions for delete using (auth.uid() = user_id);

-- Coluna de vínculo (nullable primeiro, pra backfill).
alter table public.toube_messages
  add column session_id uuid references public.toube_sessions(id) on delete cascade;

-- Backfill: 1 sessão por usuário com mensagens; carimba as mensagens dele.
insert into public.toube_sessions (user_id, title, created_at, updated_at)
select user_id, 'Conversa', min(created_at), max(created_at)
from public.toube_messages group by user_id;

update public.toube_messages m
set session_id = s.id
from public.toube_sessions s
where s.user_id = m.user_id and m.session_id is null;

alter table public.toube_messages alter column session_id set not null;
create index toube_messages_session_idx on public.toube_messages(session_id, created_at);
```

- [ ] **Step 2: types.ts** — adicionar no bloco Tables:
```ts
      toube_sessions: Table<{
        id: string;
        user_id: string;
        title: string | null;
        created_at: Timestamptz;
        updated_at: Timestamptz;
      }>;
```
E acrescentar `session_id: string;` no Row de `toube_messages`.

- [ ] **Step 3:** `pnpm exec tsc --noEmit` → 0. Pedir o usuário rodar a migration; validar via REST:
`GET /rest/v1/toube_sessions?select=id&limit=0` → 200 e `GET /rest/v1/toube_messages?select=session_id&limit=0` → 200.

- [ ] **Step 4: Commit** `git add supabase/migrations/0030_toube_sessions.sql lib/supabase/types.ts && git commit -m "feat(toube): migration 0030 sessões + session_id"`

---

### Task 2: Server actions de sessão

**Files:**
- Create: `app/(app)/toube/sessions-actions.ts`

**Interfaces:**
- Produces: `createSession(): Promise<{ id: string }>`; `renameSession(id, title): Promise<{ok?,error?}>`;
  `deleteSession(id): Promise<{ok?,error?}>`; `listSessions(): Promise<{ id: string; title: string | null; updated_at: string }[]>`.

- [ ] **Step 1: Escrever `sessions-actions.ts`**
```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, userId: user.id };
}

const isUuid = (v: string) => z.string().uuid().safeParse(v).success;

export async function createSession(): Promise<{ id: string }> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("toube_sessions")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Erro ao criar conversa");
  revalidatePath("/toube");
  return { id: data.id };
}

export async function renameSession(id: string, title: string): Promise<{ ok?: boolean; error?: string }> {
  if (!isUuid(id)) return { error: "id inválido." };
  const t = title.trim().slice(0, 120);
  if (!t) return { error: "Título vazio." };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("toube_sessions")
    .update({ title: t })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/toube");
  return { ok: true };
}

export async function deleteSession(id: string): Promise<{ ok?: boolean; error?: string }> {
  if (!isUuid(id)) return { error: "id inválido." };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("toube_sessions").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/toube");
  return { ok: true };
}

export async function listSessions(): Promise<
  { id: string; title: string | null; updated_at: string }[]
> {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase
    .from("toube_sessions")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
```

- [ ] **Step 2:** `pnpm exec tsc --noEmit && pnpm check`. E2E via service_role (`scripts/_s.mjs`): inserir sessão pra um user real, renomear, listar, apagar (cascade); conferir escopo `user_id`. Rodar e remover o script.

- [ ] **Step 3: Commit** `feat(toube): actions de sessão (create/rename/delete/list)`

---

### Task 3: Rota session-aware + /api/toube/sessions

**Files:**
- Modify: `app/api/toube/route.ts`
- Create: `app/api/toube/sessions/route.ts`

**Interfaces:**
- Consumes: `toubeReply` (lib/toube), `executeToubeRead` (lib/toube-reads) — inalterados.
- Produces: POST body `{ message, session_id }`; GET `?session=<id>` → `{ sessionId, messages }`;
  `GET /api/toube/sessions` → `{ sessions }`.

- [ ] **Step 1: Helper de sessão ativa** (no topo do route.ts, antes do handler):
```ts
// Resolve a sessão ativa: a pedida (se do usuário), senão a mais recente, senão cria uma.
async function activeSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  requested?: string | null,
): Promise<string> {
  if (requested && /^[0-9a-f-]{36}$/i.test(requested)) {
    const { data } = await supabase
      .from("toube_sessions")
      .select("id")
      .eq("id", requested)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return data.id;
  }
  const { data: recent } = await supabase
    .from("toube_sessions")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) return recent.id;
  const { data: created } = await supabase
    .from("toube_sessions")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (!created) throw new Error("sem sessão");
  return created.id;
}
```

- [ ] **Step 2: GET session-aware** — substituir o GET atual:
```ts
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const requested = new URL(req.url).searchParams.get("session");
  const sessionId = await activeSession(supabase, user.id, requested);
  const { data } = await supabase
    .from("toube_messages")
    .select("id, role, content")
    .eq("user_id", user.id)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(40);
  return NextResponse.json({ sessionId, messages: (data ?? []).reverse() });
}
```

- [ ] **Step 3: POST scoped** — no POST atual: `bodySchema` ganha `session_id: z.string().uuid()`;
carregar histórico com `.eq("session_id", session_id)`; inserir user+assistant com `session_id`;
depois de gravar, auto-título + bump:
```ts
// após inserir a mensagem do usuário (antes ou depois do toubeReply, tanto faz):
const { data: sess } = await supabase
  .from("toube_sessions")
  .select("title")
  .eq("id", session_id)
  .single();
const patch: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
if (!sess?.title) patch.title = message.slice(0, 60);
await supabase.from("toube_sessions").update(patch).eq("id", session_id).eq("user_id", user.id);
```
Os dois inserts em `toube_messages` passam a incluir `session_id`. O histórico mandado ao
`toubeReply` sai do `.eq("session_id", session_id)` — modelo só vê a sessão atual.

- [ ] **Step 4: `app/api/toube/sessions/route.ts`**
```ts
import { listSessions } from "@/app/(app)/toube/sessions-actions";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({ sessions: await listSessions() });
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
```

- [ ] **Step 5:** `pnpm exec tsc --noEmit && pnpm check && pnpm build`. Commit `feat(toube): rota POST/GET por sessão + /api/toube/sessions`.

---

### Task 4: ToubeConversation session-aware + colar imagem

**Files:**
- Modify: `app/(app)/toube/ToubeConversation.tsx`

**Interfaces:**
- Consumes: rota POST `{ message, session_id }`.
- Produces: prop `sessionId: string` (obrigatória); `onPaste` de imagem.

- [ ] **Step 1: prop sessionId + mandar no POST** — assinatura vira
`{ initial, variant, sessionId }`; no `send()` normal (não-plano) o body vira
`JSON.stringify({ message: text, session_id: sessionId })`.

- [ ] **Step 2: onPaste de imagem** — no `<textarea>` (e opcionalmente na div raiz), handler:
```ts
function onPaste(e: React.ClipboardEvent) {
  const img = Array.from(e.clipboardData.items).find((it) => it.type.startsWith("image/"));
  if (!img) return; // sem imagem → deixa colar texto normal
  const file = img.getAsFile();
  if (file) {
    e.preventDefault();
    attachFile(file); // reusa o fluxo de anexo → Scout descreve → chip [ANEXO imagem]
  }
}
```
Adicionar `onPaste={onPaste}` no textarea. `attachFile` já existe.

- [ ] **Step 3:** `pnpm exec tsc --noEmit && pnpm check`. (Build na Task 5/6.) Commit
`feat(toube): chat por sessão + colar imagem (paste)`.

---

### Task 5: Sidebar de conversas na página /toube

**Files:**
- Create: `app/(app)/toube/ToubeSessions.tsx`
- Modify: `app/(app)/toube/page.tsx`

**Interfaces:**
- Consumes: `createSession`, `renameSession`, `deleteSession` (sessions-actions); `ToubeConversation` (sessionId).

- [ ] **Step 1: `ToubeSessions.tsx`** (client): recebe `sessions: {id,title,updated_at}[]`,
`activeId: string`, `initial: Message[]`. Estado: `active`, `sessions` (local), `messages`.
Layout: `grid md:grid-cols-[240px_1fr]` — sidebar (lista de conversas com título ou "Nova
conversa", botão **+ Nova**, ✎ renomear inline via `prompt()`, 🗑 apagar com confirm) + o
`<ToubeConversation key={active} sessionId={active} initial={messages} variant="page" />`.
Trocar de sessão: `fetch("/api/toube?session="+id)` → `setMessages(data.messages)` + `setActive(id)`.
+ Nova: `createSession()` → adiciona na lista, `setActive(novo)`, `setMessages([])`.
Apagar a ativa: cai pra próxima da lista (ou cria nova). Mobile: sidebar como `<details>`/toggle.

- [ ] **Step 2: `page.tsx`** (server): carrega `listSessions()` + resolve ativa (searchParam
`?c` ou a mais recente) + suas mensagens (query `toube_messages` por session_id) → passa pro
`<ToubeSessions>`. Se não houver sessão, o GET/activeSession cria — ou criar aqui. Substitui o
`<ToubeChat initial>` pelo `<ToubeSessions ...>` (o card do Planos e o header ficam).

- [ ] **Step 3:** `pnpm exec tsc --noEmit && pnpm check && pnpm build`. Commit
`feat(toube): sidebar de conversas na página`.

---

### Task 6: Lista de conversas no painel flutuante

**Files:**
- Modify: `components/FloatingToube.tsx`

- [ ] **Step 1:** estado `view: "chat" | "list"`, `activeSessionId`, `sessions`. Header ganha
botão **"Conversas"** (troca `view`). Na `view="list"`: busca `GET /api/toube/sessions`, mostra
lista + **+ Nova** (`createSession`) + apagar; escolher uma → `GET /api/toube?session=id` →
`setMessages` + `setActiveSessionId` + `view="chat"`. O `<ToubeConversation>` recebe
`sessionId={activeSessionId}` (obtido no 1º GET sem param, que já devolve `sessionId`).

- [ ] **Step 2:** `pnpm exec tsc --noEmit && pnpm check && pnpm build`. Commit
`feat(toube): lista de conversas no painel flutuante`.

---

### Task 7: Fecho — E2E manual + memória + push

- [ ] **Step 1:** `pnpm build` verde; push. Teste manual: criar/renomear/apagar conversa,
trocar sessões (modelo não mistura), colar print → Scout descreve, painel flutuante idem.
- [ ] **Step 2:** atualizar `memory/toube-agente-roadmap.md` (sessões entregues, migration 0030).

## Self-Review (autor)

**Cobertura do spec:** tabela+backfill+session_id → T1; actions → T2; POST/GET/sessions + auto-título
→ T3; ToubeConversation session-aware + paste → T4; sidebar página → T5; painel → T6. ✅
**Placeholders:** nenhum "TBD"; código real nos passos-chave (migration, actions, helper de sessão,
POST auto-título, onPaste). UI de T5/T6 descreve estrutura + os fetches exatos (reusa padrões de
ToubeConversation/PlanosChat já no repo).
**Consistência de tipos:** `session_id` (uuid) em toda a cadeia; `activeSession()→string`;
`listSessions()→{id,title,updated_at}[]`; `createSession()→{id}`; GET devolve `{sessionId, messages}`
consumido igual no painel e na sidebar.
