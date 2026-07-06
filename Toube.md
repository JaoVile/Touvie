# Toube — Assistente de IA (chat)

> **Status:** MVP IMPLEMENTADO (jul/2026, commit `feat(toube)`). Uma **seção nova**
> do app logado, ao lado de Treinos / Finanças / Notas — a diferença é que em vez
> de formulário é um **chat** com um assistente de IA chamado **Toube**.
> **Objetivo de produto:** um companheiro que conversa, encoraja e (fase 2)
> entende os seus dados do life OS.

## A ideia

Módulo `/toube`: uma conversa contínua com o assistente. Caloroso, direto,
encorajador (mesmo tom das Quests de Foco). MVP = chat puro; depois ele ganha
contexto dos seus dados.

## Modelo de IA — decisão (pesquisa de 03/jul/2026)

- **GLM-5.2** (Z.ai/Zhipu) existe (16/06/2026) mas **é pago** (~US$1,40/US$4,40
  por 1M tokens) — topo de linha, overkill pra chat pessoal.
- **Usar o `glm-4.7-flash`** — **GRÁTIS** na mesma API da Z.ai. Subir pro pago
  depois = trocar **uma string** (`MODEL` em `lib/toube.ts`).
- API **compatível com OpenAI**: `POST https://api.z.ai/api/paas/v4/chat/completions`,
  header `Authorization: Bearer $ZAI_API_KEY`. Chama com `fetch` puro na route
  handler; sem SDK. Key **só no servidor** (env `ZAI_API_KEY`, nunca no client).
- Planos B se a Z.ai apertar limite grátis: **Groq** (mais rápido, limite diário
  folgado) ou **Gemini Flash** (sem cartão, ~1.500 req/dia) — mesma chamada, só
  muda base URL / modelo.

## O que entrou no MVP (tudo no `main`)

1. ✅ `supabase/migrations/0024_touvi_chat.sql` — tabela `toube_messages`
   (`id`, `user_id` FK, `role` 'user'|'assistant', `content`, `created_at`) com
   RLS own-row. **Rodar à mão no SQL Editor** (como as demais migrations).
2. ✅ `lib/toube.ts` — wrapper do GLM (`fetch` → Z.ai, `MODEL = "glm-4.7-flash"`,
   key em `ZAI_API_KEY`) + o *system prompt* da persona (`TOUBE_SYSTEM`).
3. ✅ `app/api/toube/route.ts` — `getUser()` (401 se anônimo), valida a mensagem
   (zod, 1–4000 chars), grava a do usuário, manda as últimas `HISTORY_WINDOW = 20`
   ao modelo, grava a resposta, devolve `{ reply }`.
4. ✅ `app/(app)/toube/page.tsx` + `ToubeChat.tsx` — Server Component carrega o
   histórico via RLS; client component é a conversa.
5. ✅ `components/Nav.tsx` (ícone `Sparkles`) + `messages/` (pt+en) — entrada
   "Toube" no menu.

## Gotcha resolvido na implementação

- **`thinking: { type: "disabled" }`** no corpo da chamada. O `glm-4.7-flash` é
  "pensante" por padrão e gastava todo o `max_tokens` raciocinando → a resposta
  vinha **vazia**. Pra chat curto não precisamos de chain-of-thought; desligado
  fica rápido e direto. (`temperature: 0.8`, `max_tokens: 600`.)

## Fase 2 — contexto

Dar ao Toube acesso de **leitura** a resumos de finanças / rotina / metas como
contexto do prompt. **Nunca ao diário** (é zero-knowledge, nem o servidor lê o
conteúdo). O system prompt já avisa o modelo que, por ora, ele **não** tem esses
dados e deve ser honesto quando pedirem algo que dependa disso.

## Decisões em aberto (pós-MVP)

- [x] ~~Janela de histórico~~ → resolvido: `HISTORY_WINDOW = 20` mensagens.
- [ ] **Streaming** da resposta (fase 2) vs. resposta inteira de uma vez (MVP =
      inteira). Hoje a rota devolve `{ reply }` de uma vez.
- [ ] **Rate limit / abuso** — a rota chama API externa a cada mensagem e **ainda
      não tem teto**. É app pessoal, mas um limite simples por usuário evita susto
      (custo/loop). Pendência real.
- [ ] **Quais dados** o Toube vê na fase 2 e como resumir (finanças em centavos,
      rotina do dia, metas abertas).
- [ ] **Persona** — o `TOUBE_SYSTEM` está funcional; afinar tom / o que ele NÃO faz.

## O que trava (operacional)

Pôr a **API key** da z.ai em `ZAI_API_KEY` no `.env.local` **e** na **Vercel**, e
rodar a **migração 0024** no SQL Editor. Sem a key a rota devolve 502
("ZAI_API_KEY não configurada"); sem a migração o insert falha.
