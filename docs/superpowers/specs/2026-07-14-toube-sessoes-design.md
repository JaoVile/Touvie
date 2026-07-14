# Toube — sessões de conversa (+ colar imagem) — Design

> Separar a conversa do Toube em SESSÕES (estilo ChatGPT: lista, reabrir,
> renomear, apagar) pra o modelo só ler a conversa atual e não alucinar por
> acúmulo/mistura de assuntos. Bônus: colar imagem direto no chat (Ctrl+V).

**Data:** 2026-07-14
**Motivação:** hoje `toube_messages` é uma thread flat infinita por usuário; o modelo
lê as últimas 20 (mistura assuntos → já causou alucinação "FASE2_X"); a página carrega
TODAS (fica pesada com o tempo).

## Decisões (brainstorming)

1. **Sessões completas** (não só "nova conversa"): lista + reabrir + renomear + apagar.
2. **UI:** sidebar de conversas na página `/toube`; **dropdown/lista** no painel flutuante.
3. **Colar imagem** (Ctrl+V) direto no chat, reusando a infra de anexo (Scout visão).
4. Planos e áudio seguem como estão. Diário intocável.

## Seção 1 — Dados (migration 0030)

- **`toube_sessions`**: `id uuid pk`, `user_id uuid → auth.users cascade`, `title text` (null
  = auto do 1º recado), `created_at`, `updated_at`. RLS own select/insert/update/delete.
  Índice `(user_id, updated_at desc)`.
- **`toube_messages`** ganha `session_id uuid → toube_sessions on delete cascade`.
- **Backfill (no mesmo arquivo):** pra cada usuário com mensagens, cria 1 sessão
  (title "Conversa") e seta `session_id` nas mensagens dele. Depois torna `session_id`
  `not null`. Nada se perde — a thread atual vira "uma conversa".
- ⚠️ USUÁRIO roda a migration no SQL Editor.

## Seção 2 — Servidor

Novas server actions em `app/(app)/toube/actions.ts` (ou `sessions-actions.ts`):
- `createSession(): Promise<{ id: string }>` — insere sessão vazia (title null), retorna id.
- `renameSession(id, title)` — valida id/uuid, `.eq(user_id)`, title trim ≤120.
- `deleteSession(id)` — delete (cascade nas mensagens), `.eq(user_id)`.
- `listSessions(): { id, title, updated_at }[]` — order updated_at desc.

Rota `app/api/toube/route.ts`:
- **POST** passa a aceitar `session_id` no body (zod uuid). Carrega histórico SÓ
  `where session_id = X` (últimas HISTORY_WINDOW). Grava user+assistant com esse
  `session_id`. **Auto-título:** se a sessão está sem título, seta = `content.slice(0,60)`
  do 1º recado. Sempre bumpa `toube_sessions.updated_at`. Se `session_id` ausente/ inválido
  → erro 400 (o client sempre manda um; ver UI).
- **GET** `?session=<id>` → `{ sessionId, messages }` daquela sessão. Sem param → a sessão
  mais recente do usuário (cria uma se não existir nenhuma) + suas mensagens.
- Novo **GET `app/api/toube/sessions/route.ts`** → `{ sessions: [...] }` (pro painel/sidebar).

Anti-alucinação: o modelo (`toubeReply`) recebe só o histórico da sessão atual — nunca cruza.

## Seção 3 — UI

- **`ToubeConversation`** vira session-aware: recebe `sessionId` + `onSessionActivity?`
  (pra sidebar/dropdown reordenarem). Manda `session_id` em todo POST. Ao trocar de sessão,
  o pai troca as `initial` messages (key por sessionId força remount limpo).
- **Página `/toube`** (server carrega sessões + sessão ativa via `?c=<id>` ou a mais recente):
  novo client `ToubeSessions` = sidebar (lista, "+ Nova", ✎ renomear, 🗑 apagar) + o
  `ToubeConversation` da sessão ativa ao lado. Trocar = fetch `GET ?session=id` (sem reload).
  Mobile: sidebar vira um drawer/toggle.
- **`FloatingToube`**: header ganha botão **"Conversas"** → troca o corpo do painel pra uma
  LISTA (via `GET /api/toube/sessions`) com "+ Nova" + renomear/apagar; escolher volta pro
  chat daquela sessão. Estado do painel guarda `activeSessionId`.
- **📋 Colar imagem:** `onPaste` no textarea/área do chat do `ToubeConversation` — se o
  clipboard tem `image/*`, pega o blob e manda pela MESMA `attachFile` (rota `/api/toube/anexo`
  → Scout descreve → chip `[ANEXO imagem]`). Funciona na página e no painel (componente
  compartilhado). Sem imagem no paste → comportamento normal (cola texto).

## Fluxos / bordas

- **Nova conversa:** `createSession` → client troca pra ela (chat vazio, título aparece no 1º recado).
- **Apagar a sessão ativa:** cai pra mais recente restante; se não sobrar nenhuma, cria uma nova.
- **Sem sessões (usuário novo):** a 1ª carga cria uma sessão vazia.
- **Renomear:** inline na sidebar/lista.
- Planos: sessão à parte (planHistory), não entra aqui.

## Fora do v1 (YAGNI)

Busca dentro/entre conversas, pastas, compartilhar, títulos gerados por IA (usamos o
recorte do 1º recado), paginação infinita da lista (order desc + limite alto basta).

## Portão

`pnpm exec tsc --noEmit` + `pnpm check` + `pnpm build` + smokes (toubeReply lê só a sessão;
E2E das actions de sessão via service_role) + teste manual (criar/trocar/renomear/apagar +
colar print).

## Arquivos (previsão)

- `supabase/migrations/0030_toube_sessions.sql` (novo) + `lib/supabase/types.ts`
- `app/(app)/toube/actions.ts` (+ create/rename/delete/listSessions) — ou `sessions-actions.ts`
- `app/api/toube/route.ts` (POST/GET session-aware) + `app/api/toube/sessions/route.ts` (novo)
- `app/(app)/toube/ToubeConversation.tsx` (sessionId + onPaste) 
- `app/(app)/toube/ToubeSessions.tsx` (novo — sidebar) + `app/(app)/toube/page.tsx`
- `components/FloatingToube.tsx` (lista de conversas no painel)
