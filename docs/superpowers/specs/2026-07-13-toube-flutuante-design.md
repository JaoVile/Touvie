# Toube Flutuante + Áudio + Anexos (Fase 7) — Design

> O Toube sai da aba dele e passa a acompanhar a pessoa pelo app inteiro:
> bolha flutuante → painel lateral com a MESMA conversa, a página ao lado
> atualiza ao vivo quando uma ação confirmada executa — e o chat ganha
> entrada de ÁUDIO (transcrição) e ANEXOS (imagem "vista" por modelo de
> visão; PDF/texto extraído), nos dois lugares de uma vez.

**Data:** 2026-07-13
**Fatia:** 7A (flutuante+vivo+descoberta) + áudio + anexos, numa fase só — a barra de
anexos nasce dentro do `ToubeConversation` compartilhado. Voz do Toube (TTS) fica pra
depois; arquivo sem caso de uso claro (planilha etc.) fora.
**Custo:** zero — Groq free tier (Whisper + Llama 4 Scout visão), chave já na Vercel.

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

## Áudio e anexos (na barra do ToubeConversation — vale pra página E painel)

**🎤 Áudio → transcrição (revisa antes de enviar):**
- Botão de microfone ao lado do campo. Grava com `MediaRecorder` (webm/opus); tocar de
  novo para o registro. Limite ~60s (corta e avisa).
- Envia pra **`POST /api/toube/transcribe`** → **Groq Whisper** (`whisper-large-v3-turbo`,
  free tier) com `language=pt` → devolve `{ text }`.
- A transcrição **preenche o campo de texto** — a pessoa revisa/corrige e aperta Enviar.
  (Decisão explícita: Whisper erra valor/nome, e o Toube AGE nos dados — revisar evita
  proposta errada.)
- Sem suporte a `MediaRecorder`/permissão negada → botão some/avisa; o chat segue normal.

**📎 Anexos (imagem, PDF, .txt/.md):**
- Botão de clipe → file picker (`image/*`, `application/pdf`, `text/*`). Máx ~8MB.
- **Imagem:** o cérebro (glm-4.7-flash) é text-only. `POST /api/toube/anexo` manda a
  imagem pro **Groq Llama 4 Scout** (free tier, visão) com prompt "descreva objetivamente
  em PT-BR o que há na imagem (textos, números, itens)" → a DESCRIÇÃO volta.
- **PDF:** extrai texto com o `extractFromPdf` que já existe (`lib/planos-source.ts`).
- **.txt/.md:** lê direto.
- O resultado vira um bloco anexado à PRÓXIMA mensagem do usuário:
  `"[ANEXO (imagem|pdf|texto) — resumo do conteúdo]:\n<texto truncado ~6k chars>"`,
  concatenado à mensagem digitada antes do POST /api/toube. O modelo responde/age em cima
  (ex.: foto de recibo → ele propõe lancar_transacao com o valor lido).
- UI: chip do anexo em cima do campo (nome + ✕ pra remover) enquanto não enviou.
- **Nada é armazenado**: áudio/arquivo são processados na rota e descartados — nenhum
  bucket, nenhuma persistência do binário. (O texto extraído entra na conversa, que já
  é persistida como sempre foi.)
- Guardrail intacto: anexo NÃO cria caminho novo pro diário (nenhuma rota lê
  journal_entries; a descrição de imagem é só contexto de conversa).

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

Voz do Toube (TTS — próxima fase), envio de vídeo, planilhas/CSV no chat (o import de
CSV já existe em Finanças), badge de não-lido, arrastar/redimensionar painel, atalho de
teclado, streaming de resposta, armazenar anexos.

## Erros (adicional anexos/áudio)

- Groq indisponível/rate limit na transcrição ou visão → mensagem amigável no chat
  ("não consegui ouvir/ver agora"), campo segue utilizável.
- Imagem ilegível → a descrição do modelo já diz; PDF sem texto → msg do extractFromPdf.
- Anexo grande demais (>8MB) → recusa client-side com aviso.

## Portão

`pnpm exec tsc --noEmit` + `pnpm check` + `pnpm build` + smokes ao vivo (Whisper com um
áudio de teste; Scout com uma imagem de teste; ambos ANTES de fiar a UI neles) + teste
manual do usuário (painel em Finanças → gasto por áudio → confirmar → lista atualiza).

## Arquivos (previsão)

- `app/(app)/toube/ToubeConversation.tsx` (novo — extraído de ToubeChat, + barra de anexos/mic)
- `app/(app)/toube/ToubeChat.tsx` (vira wrapper)
- `components/FloatingToube.tsx` (novo)
- `app/(app)/layout.tsx` (monta o FloatingToube)
- `app/api/toube/route.ts` (novo handler GET — histórico)
- `app/api/toube/transcribe/route.ts` (novo — Groq Whisper)
- `app/api/toube/anexo/route.ts` (novo — imagem→Scout descrição; PDF/txt→texto)
- `lib/groq.ts` (ganha helper de multipart/transcrição e visão)
- `app/(app)/toube/page.tsx` (card do Planos no lugar da pílula)
