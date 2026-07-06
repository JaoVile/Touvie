# Foco do dia — design

> **Data:** 06/jul/2026 · **Origem:** `Quests.md` (feature planejada, agora especificada).
> **Objetivo de produto:** que todo usuário se sinta bem ao abrir o Touvie —
> encorajamento + senso de progresso nítido, num ritual leve **1×/dia**.
> **Feature opt-in** (desligada por padrão), ligada no `/config`.

## Resumo

Ao entrar no app pela primeira vez no dia, quem tiver a feature ligada vê uma
**nota sutil** com uma autoafirmação + uma pergunta ("qual seu foco hoje?"). O
usuário escreve o foco do dia → vira uma **quest flutuante** na lateral → ao
concluir, clica em *finalizar* e o app **parabeniza** mostrando quanto tempo
levou. Cada dia é uma folha nova (não acumula, sem culpa).

## Decisões fechadas (brainstorming 06/jul)

| Decisão | Escolha |
|---|---|
| **Nome** | "Foco do dia" |
| **Frequência** | 1×/dia — só na 1ª entrada do dia (BRT); se já respondeu, não repete |
| **Carryover** | Zera por dia — quest não finalizada some do overlay (fica no banco) |
| **Conteúdo** | Eu gero o banco (pt+en), usuário poda |
| **Toggle** | Coluna `focus_quest_enabled` em `profiles` (cross-device) |
| **Ações** | criar · finalizar · **descartar** (desfaz quest errada no mesmo dia) |
| **Onde vive** | Overlay global no app logado — **não** dentro de `/notas` |

## 1. Modelo de dados — migração `0025` (rodar à mão no SQL Editor)

Tabela nova `focus_quests` (own-row RLS, espelhando `touvi_messages`/`user_reminders`):

```sql
create table public.focus_quests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  text         text not null,            -- o que o usuário escreveu
  prompt       text not null,            -- a pergunta exibida (histórico)
  started_at   timestamptz not null default now(),
  completed_at timestamptz,              -- null até finalizar
  created_at   timestamptz not null default now()
);

alter table public.focus_quests enable row level security;
create index focus_quests_user_idx on public.focus_quests(user_id, started_at);

create policy "own select" on public.focus_quests for select using (auth.uid() = user_id);
create policy "own insert" on public.focus_quests for insert with check (auth.uid() = user_id);
create policy "own update" on public.focus_quests for update using (auth.uid() = user_id);
create policy "own delete" on public.focus_quests for delete using (auth.uid() = user_id);

alter table public.profiles
  add column focus_quest_enabled boolean not null default false;
```

- **"Quest de hoje"** = linha do usuário cujo `started_at` cai na **data BRT de
  hoje** (via `todayBRT` de `lib/datetime`). Filtro: `started_at >= <início do dia
  BRT em UTC>`. Só a mais recente importa (1×/dia).
- `update` policy é necessária pro `finalizar` (seta `completed_at`); `delete`
  pro `descartar`.
- Tipar a tabela + a coluna nova em `lib/supabase/types.ts`.

## 2. Componentes e fluxo de dados

### 2.1 Overlay `components/focus-quest/FocusQuest.tsx` (client)

Plugado no `app/(app)/layout.tsx`, **depois do `<Nav />`**. Só é renderizado
quando `focus_quest_enabled`. Recebe do server: `initial` (quest de hoje ou null)
e roda uma **máquina de 3 estados**:

- **convite** — sem quest hoje: card sutil com autoafirmação (sorteada) +
  pergunta (sorteada) + campo de texto + botão criar.
- **ativa** — há quest de hoje sem `completed_at`: balão flutua discreto na
  lateral com o `text`, botão **finalizar** e um **descartar** discreto.
- **concluída** — após finalizar: **parabéns** (mensagem sorteada) + **duração**
  formatada (`completed_at − started_at`); some depois de alguns segundos / ao
  fechar.

Estética: glass + navy/ouro do tema `royal`; entrada via `<Reveal>` e tokens
`--ease-*`. Sorteio de mensagens no client (`Math.random`), a partir dos bancos
i18n. A "flutuação" é sutil e sempre à vista, nunca cobradora.

### 2.2 Carregamento (server)

O `AppLayout` (server component) já busca o `user`. Passa a ler também
`focus_quest_enabled` do `profiles` e, **se ligado**, faz **uma** query da quest
de hoje em `focus_quests`; passa `enabled` + `initial` pro `<FocusQuest />`. Se
desligado, não consulta `focus_quests` (custo zero) e o overlay não monta.

### 2.3 Server actions `components/focus-quest/actions.ts` (`"use server"`)

Espelham `components/reminders/actions.ts`, via `createClient()` (RLS, sem
service_role):

- `createQuest(text, prompt)` — valida `text` (zod, 1–280 chars) e **guarda
  anti-duplicata**: se já existe quest de hoje, não cria outra (retorna a
  existente). Insert com `user_id = auth.uid()`.
- `completeQuest(id)` — `update … set completed_at = now()` onde `id` e dono e
  `completed_at is null`. Retorna a linha atualizada (`started_at` +
  `completed_at`); **o client calcula e formata a duração** a partir desses dois
  timestamps.
- `discardQuest(id)` — `delete` da quest de hoje do dono (desfaz engano).

### 2.4 Config `app/(app)/config/FocusQuestToggle.tsx` (client)

Card novo em `/config` espelhando o `StarsToggle`, mas como a preferência agora é
**coluna no banco**, persiste via server action `setFocusQuestEnabled(bool)` (não
localStorage). Ligado/Desligado com o mesmo visual dos outros toggles.

## 3. Conteúdo (i18n, `messages/pt-BR.json` + `messages/en.json`)

Namespace novo `focoDoDia`, lido via `t.raw("focoDoDia.<lista>")` (arrays):

- `affirmations` — ~15–20 frases de encorajamento leve/caloroso.
- `questions` — ~6–8 variações da pergunta (mesmo sentido): "O que você quer
  fazer hoje?", "Qual seu foco agora?", …
- `congrats` — ~10 mensagens de finalização, com placeholder `{duration}`,
  enquadrando como fração do caminho rumo ao futuro.

Eu gero o banco inicial nos dois idiomas no tom do app; o usuário poda depois.
Paridade de chaves validada por `pnpm check:i18n`.

## 4. Erros e casos de borda

- **Fuso:** "hoje" é sempre BRT (`todayBRT`), não o fuso do servidor — senão a
  quest "vira" à meia-noite errada.
- **Duplicata:** a guarda em `createQuest` + o filtro "quest de hoje" garantem no
  máximo uma quest ativa por dia (mesmo com corridas de aba).
- **Desligado / anônimo:** overlay não monta (layout já redireciona anônimo pra
  `/login`).
- **Duração:** formatar amigável ("12 min", "1 h 03"); se `completed_at` vier
  antes de `started_at` por skew, mostra "agora".

## 5. Fora de escopo (YAGNI)

- Sem streak / histórico visível (os dados ficam, mas não há tela deles).
- Sem carryover de quest não finalizada.
- Sem editar o texto depois de criado (só criar / finalizar / descartar).
- Não vive dentro do módulo `/notas`.

## 6. Arquivos afetados

- `supabase/migrations/0025_focus_quests.sql` — **novo** (rodar à mão).
- `lib/supabase/types.ts` — tipar `focus_quests` + `profiles.focus_quest_enabled`.
- `components/focus-quest/FocusQuest.tsx` · `actions.ts` — **novos**.
- `app/(app)/layout.tsx` — buscar `enabled` + quest de hoje; montar overlay.
- `app/(app)/config/FocusQuestToggle.tsx` — **novo**; plugar no `/config`.
- `messages/pt-BR.json` · `messages/en.json` — namespace `focoDoDia`.
