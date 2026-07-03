# Touvi — Assistente de IA (chat)

> **Status:** planejado. Uma **seção nova** do app logado, ao lado de Treinos /
> Finanças / Notas — a diferença é que em vez de formulário é um **chat** com um
> assistente de IA chamado **Touvi**.
> **Objetivo de produto:** um companheiro que conversa, encoraja e (fase 2)
> entende os seus dados do life OS.

## A ideia

Módulo `/touvi`: uma conversa contínua com o assistente. Caloroso, direto,
encorajador (mesmo tom das Quests de Foco). MVP = chat puro; depois ele ganha
contexto dos seus dados.

## Modelo de IA — decisão (pesquisa de 03/jul/2026)

- **GLM-5.2** (Z.ai/Zhipu) existe (16/06/2026) mas **é pago** (~US$1,40/US$4,40
  por 1M tokens) — topo de linha, overkill pra chat pessoal.
- **Usar o `glm-4.7-flash`** — **GRÁTIS** na mesma API da Z.ai. Subir pro pago
  depois = trocar **uma string** (`model`).
- API **compatível com OpenAI**: `POST https://api.z.ai/api/paas/v4/chat/completions`,
  header `Authorization: Bearer $ZAI_API_KEY`. Chama com `fetch` puro numa route
  handler; sem SDK. Key **só no servidor** (env `ZAI_API_KEY`, nunca no client).
- Planos B se a Z.ai apertar limite grátis: **Groq** (mais rápido, limite diário
  folgado) ou **Gemini Flash** (sem cartão, ~1.500 req/dia) — mesma chamada, só
  muda base URL / modelo.

## Plano de implementação (segue as convenções do repo)

**MVP — chat puro:**
1. `supabase/migrations/0024_touvi_chat.sql` — tabela `touvi_messages`
   (`id`, `user_id` FK, `role` 'user'|'assistant', `content`, `created_at`),
   RLS own-row espelhando `user_reminders`. Rodar à mão no SQL Editor.
2. `lib/supabase/types.ts` — tipar a tabela nova.
3. `lib/touvi.ts` — wrapper do GLM (`fetch` → Z.ai, `model: "glm-4.7-flash"`,
   key em `ZAI_API_KEY`) + o *system prompt* da persona Touvi.
4. `app/api/touvi/route.ts` — `requireUser()`, valida a mensagem (zod), salva a
   do usuário, chama o GLM com o histórico recente, salva a resposta, devolve.
5. `app/(app)/touvi/page.tsx` + `TouviChat.tsx` — Server Component carrega o
   histórico via RLS; client component é a conversa.
6. `components/Nav.tsx` + `messages/` (pt+en) — entrada "Touvi" no menu.
7. Env: `ZAI_API_KEY` no `.env.local` **e** na Vercel.

**Fase 2 — contexto:** dar ao Touvi acesso de **leitura** a resumos de finanças
/ rotina / metas como contexto do prompt. **Nunca ao diário** (é zero-knowledge,
nem o servidor lê o conteúdo).

## Decisões em aberto

- [ ] **Streaming** da resposta (fase 2) vs. resposta inteira de uma vez (MVP).
- [ ] **Janela de histórico** enviada ao modelo (ex.: últimas N mensagens) pra
      não estourar contexto/custo.
- [ ] **Quais dados** o Touvi vê na fase 2 e como resumir (finanças em centavos,
      rotina do dia, metas abertas).
- [ ] **Rate limit / abuso** — é app pessoal, mas a rota chama API externa; um
      teto simples por usuário evita susto.
- [ ] **Persona** — afinar o system prompt (tom, o que ele NÃO faz).

## O que trava

Criar conta na **z.ai**, gerar a **API key** e pôr em `ZAI_API_KEY` (só o dono
faz). O resto do scaffold pode ser construído antes; o chat responde no segundo
em que a key entra.
