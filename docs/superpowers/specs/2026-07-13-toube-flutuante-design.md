# Toube Flutuante (Fase 7A) — Design

> O Toube sai da aba dele e passa a acompanhar a pessoa pelo app inteiro:
> bolha flutuante → painel lateral com a MESMA conversa, e a página ao lado
> atualiza ao vivo quando uma ação confirmada executa.

**Data:** 2026-07-13
**Fatia:** 7A do "Toube Onipresente" (7B voz = próxima fase; 7C arquivo no chat = adiado).
**Custo:** zero — só frontend sobre a API existente (`/api/toube`).

## Decisões travadas (brainstorming)

1. **Painel lateral** (não popover, não modal): ~400px encostado à direita no desktop,
   página continua visível e interagível ao lado; no mobile vira folha ~92% da tela.
2. **Abordagem A**: extrair o miolo do `ToubeChat.tsx` num componente compartilhado
   (`ToubeConversation`) usado pela página `/toube` E pelo painel — uma fonte de verdade.
3. **Entrada do Planos**: card de verdade na página `/toube` (a pílula atual passou batida)
   + atalho fixo no cabeçalho do painel flutuante.
4. **Histórico único**: painel e página compartilham a mesma conversa (`toube_messages`).

## Componentes

- **`app/(app)/toube/ToubeConversation.tsx`** (novo — extração, não reescrita): mensagens,
  envio, indicador "digitando", cards de proposta (confirmar/cancelar/destrutivo), erros.
  Props: `initial: Message[]` e `variant: "page" | "panel"` (só espaçamento/altura).
  `ToubeChat.tsx` vira um wrapper fino que renderiza `ToubeConversation variant="page"`
  (mantém o import da página estável).
- **`components/FloatingToube.tsx`** (novo, client): bolha fixa (canto inferior direito,
  ícone Sparkles, z-index acima do conteúdo) → abre/fecha o painel. Painel: header com
  "Toube" + atalho 🏋️ **Planos** (`/toube/planos`) + botão fechar; corpo = `ToubeConversation
  variant="panel"`. Histórico carregado client-side ao abrir a primeira vez (fetch leve a um
  endpoint existente OU aceita `initial=[]` e busca via nova rota GET — ver Dados).
- **Montagem:** `app/(app)/layout.tsx` renderiza `<FloatingToube />` uma vez — por estar no
  layout, o estado (aberto + conversa em memória) sobrevive à navegação entre páginas.
- **Ocultação:** a bolha NÃO aparece em `/toube` e `/toube/planos` (redundante) nem em
  `/diario` (o assistente não paira sobre o diário — coerência com a regra de ouro).
  Detecção via `usePathname()`.

## Comportamento-chave: mudança ao vivo

Quando uma proposta confirmada executa com sucesso (`executeToubeAction` → `{ok:true}`),
o componente chama `router.refresh()` — os Server Components da rota atual re-renderizam
e o dado novo aparece na página ao lado (gasto na lista de Finanças, meta em Metas, bloco
na Rotina). As server actions já fazem `revalidatePath`, então o refresh pega dado fresco.

## Dados

- Zero mudança de schema. Zero mudança nas rotas de chat (`POST /api/toube` continua igual).
- **Histórico no painel:** novo handler **`GET /api/toube`** (mesmo arquivo da rota atual)
  que devolve as últimas N mensagens do usuário (auth igual ao POST). O painel busca ao abrir
  pela primeira vez; depois mantém em memória (mesmo comportamento da página).
- Página `/toube` continua carregando o histórico server-side (sem mudança).

## Card do Planos (página /toube)

Substituir a pílula por um card: ícone Dumbbell grande, título "Planos de treino",
descrição curta ("Monta teu treino conversando — cola um vídeo ou PDF e ele estrutura
tudo"), seta →. Mesmo estilo de card do app (var(--color-card), borda, radius).

## Erros

- Mesmos do chat atual (mensagem vermelha no painel).
- Falha no GET do histórico → painel abre vazio com aviso discreto e deixa conversar
  (o POST grava normal).
- `router.refresh()` não tem erro observável; é fire-and-forget.

## Fora de escopo (YAGNI)

Áudio/voz (7B), arquivo no chat geral (7C), badge de não-lido, arrastar/redimensionar
painel, atalho de teclado, streaming de resposta.

## Portão

`pnpm exec tsc --noEmit` + `pnpm check` + `pnpm build` + teste manual do usuário
(abrir painel em Finanças → lançar gasto pelo chat → confirmar → ver a lista atualizar).

## Arquivos (previsão)

- `app/(app)/toube/ToubeConversation.tsx` (novo — extraído de ToubeChat)
- `app/(app)/toube/ToubeChat.tsx` (vira wrapper)
- `components/FloatingToube.tsx` (novo)
- `app/(app)/layout.tsx` (monta o FloatingToube)
- `app/api/toube/route.ts` (novo handler GET — histórico)
- `app/(app)/toube/page.tsx` (card do Planos no lugar da pílula)
