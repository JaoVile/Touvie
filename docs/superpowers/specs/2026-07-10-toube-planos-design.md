# Toube Planos — Design (v1)

> Construtor guiado de plano de treino dentro do Toube. O usuário conversa (e
> opcionalmente dá uma fonte: link/YouTube/PDF), o Toube monta o plano peça por
> peça num rascunho vivo e, no fim, cadastra tudo no app num único confirmar.

**Data:** 2026-07-10
**Fase:** 6 do roadmap do agente Toube (ver `memory/toube-agente-roadmap.md`)
**Depende de:** módulo Treino existente (`workout_programs/days/exercises/day_exercises`
+ actions `saveProgram/saveProgramDay/saveExercise/saveDayExercise`).

## Decisões travadas (brainstorming)

1. **Rascunho persiste** — tabela `workout_program_drafts` (fecha o app e volta de onde parou).
2. **v1 já com ingestão de fonte** — colar link/YouTube/PDF como base do plano.
3. **Modelo Groq `llama-3.3-70b-versatile`** (free) só nos Planos; o resto do Toube segue no glm-4.7-flash.
4. **Commit único** — no fim, um card de review do plano inteiro → 1 botão "Criar programa completo".
5. **Abordagem A** — rascunho como JSONB, tools que MUTAM o rascunho (aplicação imediata, sem
   confirmação por edição); a confirmação existe só no commit final.

## Escopo

**No v1:** criar um PROGRAMA DE TREINO via chat guiado + ingestão de fonte (texto/link/YouTube/PDF)
+ rascunho persistente + commit único.

**Fora do v1 (YAGNI):** upload de vídeo cru (precisa pipeline de transcrição tipo Whisper),
gerenciar vários rascunhos, editar programa já existente pelos Planos, planos de dieta/estudo.

## Onde vive / UI

- **Rota:** `/toube/planos` (sub-seção do Toube; link a partir de `/toube`).
- **Layout split:** chat de um lado, **plano vivo** (`PlanPreview`) do outro, atualizando a cada turno.
  No mobile empilha (plano em cima, chat embaixo).
- **Entrada de fonte:** campo pra colar URL (YouTube/link) + botão anexar PDF, no topo do chat.
- **Rodapé:** com o plano de pé, botão "Criar programa completo" → card de review final.

**Componentes:**
- `app/(app)/toube/planos/page.tsx` — server component; carrega o rascunho `building` atual (ou vazio).
- `PlanosChat.tsx` — client; fala com `/api/toube/planos`; renderiza `PlanPreview` do rascunho.
- `PlanPreview.tsx` — renderiza `draft.plan` (dias + exercícios) ao vivo.
- `SourceInput.tsx` — colar URL / anexar PDF.
- Card de review final + botão de commit (dentro do `PlanosChat` ou componente próprio).

## Dados — migration `0028_workout_program_drafts`

Tabela `workout_program_drafts` (RLS own-only, espelhando o padrão das outras tabelas):

| coluna | tipo | pra quê |
|---|---|---|
| `id` | uuid pk default gen_random_uuid() | |
| `user_id` | uuid not null → auth.users on delete cascade | dono (RLS) |
| `plan` | jsonb not null default '{}' | o rascunho inteiro (contrato abaixo) |
| `source_kind` | text null | 'text' \| 'youtube' \| 'link' \| 'pdf' (informativo) |
| `status` | text not null check(status in ('building','committed')) default 'building' | |
| `created_program_id` | uuid null → workout_programs on delete set null | programa real gerado |
| `created_at` | timestamptz not null default now() | |
| `updated_at` | timestamptz not null default now() | |

RLS: policies own select/insert/update/delete (`auth.uid() = user_id`). Índice
`(user_id, status, updated_at desc)` pra achar o rascunho em aberto.

**Contrato do `plan` (JSONB):**
```json
{
  "name": "Hipertrofia ABC",
  "days": [
    {
      "weekday": 1,
      "name": "Peito/Tríceps",
      "exercises": [
        {
          "name": "Supino reto",
          "muscle_group": "Peito",
          "target_sets": 4,
          "reps_low": 8,
          "reps_high": 12,
          "notes": null
        }
      ]
    }
  ]
}
```
- `weekday`: 0=Dom … 6=Sáb. `target_sets`/`reps_low`/`reps_high`: int nullable.
- Um rascunho `building` por vez no v1: a página abre o mais recente ou cria novo. "Novo plano" começa do zero.
- O `plan` é só rascunho — nada toca as tabelas reais de treino até o commit.

## O cérebro — `lib/toube-planos.ts`

Adapter separado do `lib/toube.ts` (provedor e prompt diferentes):
- Chama **Groq `llama-3.3-70b-versatile`** via endpoint OpenAI-compatível (`GROQ_API_KEY`).
- A cada turno recebe: **rascunho atual (JSON) + histórico + texto da fonte** (quando houver);
  devolve tool_calls que **editam o rascunho**.
- Prompt: monta plano de treino realista; usa a fonte quando existir; pergunta o que falta
  (divisão, dias/semana, objetivo) peça por peça; PT-BR natural.

**Aplicação imediata (sem confirmação por edição):** o rascunho não é dado real e o plano vivo
na tela já é o feedback. As tools aplicam na hora no JSON; a confirmação existe só no commit final.

**Tools que mutam o rascunho** (validadas e aplicadas server-side, determinístico):

| tool | efeito |
|---|---|
| `montar_do_zero(name, days[])` | substitui o rascunho inteiro (ingestão de fonte / "monta um ABC 5x") |
| `definir_nome(name)` | renomeia o plano |
| `add_dia(weekday, name)` | adiciona um dia |
| `editar_dia(dia_index, weekday?, name?)` | edita um dia |
| `remover_dia(dia_index)` | remove um dia |
| `add_exercicio(dia_index, name, muscle_group?, target_sets?, reps_low?, reps_high?)` | |
| `editar_exercicio(dia_index, ex_index, …campos)` | |
| `remover_exercicio(dia_index, ex_index)` | |

Índices (dia/exercício) vão numerados no contexto do modelo (como os ids das metas), pra edição
ser inequívoca. O servidor valida cada mutação (índice existe, weekday 0-6, sets/reps em range),
aplica no `plan`, persiste (`updated_at`) e devolve `{reply, draft}`.

## Ingestão de fonte — `POST /api/toube/planos/fonte`

Endpoint separado que extrai texto e alimenta um `montar_do_zero`:
- **Link comum:** fetch + extração de texto legível.
- **YouTube:** busca o **transcript** por lib de transcript. **Caveat honesto:** vídeo sem
  legenda/transcript → falha; aviso claro e o fluxo segue no modo "descreve pra mim".
- **PDF:** upload → parser de texto (`unpdf` ou `pdf-parse`).
- O texto extraído é truncado pra caber no contexto; **não é salvo** — só o plano resultante.
- `source_kind` do rascunho registra a origem (informativo).

## Commit — `criar_programa_completo` (server action, ÚNICO confirmar)

1. Lê o rascunho `building` do usuário.
2. Bloqueia se o plano estiver vazio ("monta pelo menos um dia").
3. Cria `workout_programs` (name).
4. Pra cada dia → `workout_days` (weekday, name).
5. Pra cada exercício → **acha-ou-cria** no catálogo `exercises` (por nome, do usuário) →
   `workout_day_exercises` (sort_order sequencial, target_sets/reps_low/high, notes).
6. Marca rascunho `committed`, grava `created_program_id`. **Não ativa o programa automaticamente**
   (evita desativar em silêncio um programa ativo existente — `setActiveProgram` zera os outros). O
   programa aparece na lista do Treino e o usuário ativa quando quiser. A resposta do Toube oferece
   ("quer deixar esse como ativo?").

**Atomicidade:** supabase-js não faz transação multi-statement. Se algo falhar depois do passo 3,
**apaga o programa criado** (cascade derruba dias/junctions) e reporta — nada de meio-programa.
Exercícios novos no catálogo podem sobrar (inofensivo). *(Alternativa futura: fazer via RPC/função
Postgres pra transação real — fora do v1.)*

## Erros tratados

- Fonte sem transcript / link ilegível / PDF sem texto → mensagem clara; segue no modo descritivo.
- Groq fora do ar / rate limit → aviso; rascunho intacto (não perde nada).
- Mutação inválida do modelo (índice inexistente, range) → ignora a tool e mantém o rascunho.
- Rascunho vazio no commit → bloqueia com mensagem.

## Portão de qualidade (não há testes automatizados)

- `pnpm check` (biome) + `pnpm exec tsc --noEmit` + `pnpm build`.
- **Smoke** do Groq: tool-calling mutando o rascunho a partir de frases ("monta um ABC 5x",
  "tira o dia de perna", "põe mais um exercício de bíceps no dia 2").
- **E2E no banco** do commit: a partir de um rascunho, confirmar que criou programa + dias +
  exercícios + junctions corretos, e que rollback apaga o programa se um passo falhar.

## Env novo

- `GROQ_API_KEY` — chave do Groq (free tier). Documentar em `.env.local.example` + `docs/OPERATIONS.md`.

## Arquivos (previsão)

- `supabase/migrations/0028_workout_program_drafts.sql` (novo)
- `lib/supabase/types.ts` (add `workout_program_drafts`)
- `lib/toube-planos.ts` (novo — adapter Groq + tools + apply/validação do rascunho)
- `lib/groq.ts` (novo — cliente Groq, ou reaproveitar padrão do fetch OpenAI-compatível)
- `app/api/toube/planos/route.ts` (novo — turno de chat)
- `app/api/toube/planos/fonte/route.ts` (novo — ingestão)
- `app/(app)/toube/planos/page.tsx` + `PlanosChat.tsx` + `PlanPreview.tsx` + `SourceInput.tsx` (novos)
- `app/(app)/toube/planos/actions.ts` (novo — `criar_programa_completo`, `novoRascunho`)
- `.env.local.example`, `docs/OPERATIONS.md` (GROQ_API_KEY)
