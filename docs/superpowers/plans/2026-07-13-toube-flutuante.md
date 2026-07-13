# Toube Flutuante + Áudio + Anexos (Fase 7) — Plano

> Execução INLINE nesta sessão (executor = controller, contexto completo), com o
> portão do projeto por etapa: `pnpm exec tsc --noEmit` + `pnpm check` + `pnpm build`
> + smoke ao vivo das integrações ANTES de fiar UI nelas. Spec:
> `docs/superpowers/specs/2026-07-13-toube-flutuante-design.md`.

**Meta:** bolha flutuante → painel lateral com a MESMA conversa em qualquer página;
página atualiza ao vivo após ação confirmada; chat (página+painel) ganha áudio
(Whisper→campo pra revisar) e anexos (imagem via Llama 4 Scout visão; PDF/txt via
extractFromPdf); card do Planos decente. Custo zero (Groq free).

## Etapas (cada uma termina verificável + commit)

1. **De-risk (smoke ao vivo, sem código de produto):** Groq Whisper
   (`whisper-large-v3-turbo`, multipart) com `public/sounds/piano-4.mp3` → espera 200 +
   campo text; Groq visão (`meta-llama/llama-4-scout-17b-16e-instruct`, image_url base64)
   com `public/brand/touvie-og.png` → espera descrição. Se um modelo não existir no free
   tier, escolher o equivalente listado pela API (`/models`) ANTES de codar.
2. **`lib/groq.ts`:** helpers `groqTranscribe(file: Blob|File): Promise<string>` (endpoint
   `/openai/v1/audio/transcriptions`, model do passo 1, `language=pt`) e
   `groqVision(dataUrl: string): Promise<string>` (chat completions com content
   image_url + prompt de descrição objetiva PT-BR). Gate: tsc+biome.
3. **Rotas:** `GET /api/toube` (histórico N=40, auth igual POST); `POST
   /api/toube/transcribe` (FormData audio ≤8MB → groqTranscribe → `{text}` | 422);
   `POST /api/toube/anexo` (FormData file ≤8MB: image/* → groqVision; application/pdf →
   extractFromPdf; text/* → texto direto; retorna `{kind, text}` truncado ~6k | 422).
   Gate: tsc+biome+build.
4. **Refactor:** extrair `ToubeConversation.tsx` de `ToubeChat.tsx` (mensagens, envio,
   digitando, cards de proposta, erro) com `variant: "page"|"panel"`; `ToubeChat` vira
   wrapper `variant="page"`. Comportamento IDÊNTICO (diff de comportamento zero na página).
   + `router.refresh()` após executeToubeAction ok. Gate: tsc+biome+build.
5. **Barra multimodal no ToubeConversation:** botão mic (MediaRecorder webm/opus, ~60s
   cap, estado gravando com stop; transcrição PREENCHE o input) + botão clipe (picker
   image/pdf/txt, chip com ✕, conteúdo extraído vai como bloco `[ANEXO …]` concatenado à
   próxima mensagem). Degradação: sem MediaRecorder/permissão → some/avisa. Gate completo.
6. **`components/FloatingToube.tsx` + montagem no `app/(app)/layout.tsx`:** bolha fixa
   (Sparkles, canto inf. dir., acima do conteúdo) oculta em `/toube*` e `/diario`
   (usePathname); painel lateral fixo ~400px desktop / folha ~92vh mobile; header
   "Toube" + atalho 🏋️ Planos + fechar; corpo `ToubeConversation variant="panel"`
   (histórico via GET na primeira abertura). Gate completo.
7. **Card do Planos** no `/toube` (Dumbbell + título + descrição + →) no lugar da pílula.
8. **Fecho:** gate completo, smoke E2E do fluxo por código onde der, commit(s), push
   (deploy), memória atualizada. Teste manual do usuário: painel em Finanças → gasto por
   áudio → confirmar → lista atualiza.

## Riscos mapeados
- Nome/disponibilidade dos modelos Groq free → etapa 1 resolve antes de tudo.
- Refactor do ToubeChat quebrar a página atual → etapa 4 é extração fiel (sem redesign);
  conferir com build + leitura do diff.
- MediaRecorder formato aceito pelo Whisper → webm/opus é aceito; smoke com arquivo real.
- iOS Safari MediaRecorder (mp4/aac) → aceito pelo Whisper também; detectar mimeType
  suportado em runtime (`MediaRecorder.isTypeSupported`).
