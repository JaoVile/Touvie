# Touvie — Roadmap

> Estado (15/jul/2026): os **3 bloqueadores do MVP estão prontos e no `main`**
> (cadastro, diário zero-knowledge, contagem/analytics), e o **assistente Toube**
> evoluiu bem além do MVP — hoje age nos módulos, lê os dados, monta planos de
> treino, tem painel flutuante, voz e visão (ver `README.md` e `CLAUDE.md`). O que
> resta antes do vídeo é pequeno; o resto é pós-launch.

Prioridade: **P0** = trava o launch · **P1** = logo depois · **P2** = quando der.

---

## 1. Pré-launch — fechar antes do vídeo

- **P0 — Testar o diário no navegador.** Fluxo completo em `/diario`: ativar
  (PIN + palavra-chave) → salvar o código de recuperação → escrever → recarregar
  (pede PIN) → "esqueci o PIN" (palavra-chave e código) → Gerenciar (trocar PIN /
  desligar). Validado por testes e2e; falta o olho humano.
- **P0 — Habilitar métricas na Vercel** (no deploy): abas **Analytics** e
  **Speed Insights** → Enable. Sem isso não coletam nada.
- **P1 — Limpar o card "PIN do Diário" no `/config`.** Hoje aponta pro sistema
  antigo (PIN legado via `pin_hash`, que o diário ZK não usa mais). Trocar por um
  texto curto: "o diário privado é ligado/gerenciado dentro do `/diario`".
- **P1 — Conferir build de produção** (`next build` sem o dev rodando) antes de
  deploy — pegar erro que só aparece em prod.
- **P2 — Security review da cripto** (`/security-review`) antes de abrir pro
  público — é o pedaço mais sensível.

## 2. Pós-launch — v1.1

- **Cápsula do tempo / "jogar pro universo"** (ideia do usuário). Selar uma
  intenção/carta por X tempo; quando a data chega, abre no app e manda um aviso
  no **Telegram** ("e aí, como foi?"). Reusa o cron+Telegram que já existem, e
  pode ser **cifrada** reusando `lib/diary-crypto` (nem nós lemos a carta pro
  futuro). ~meio dia.
- **PDF "retomar página"** no `/leitura` — a coluna `current_page` existe mas não
  é usada; salvar e voltar de onde parou. ~2h.
- ~~**Quests de foco do dia**~~ → **construída** e em prod como "Foco do dia"
  (ver seção 4 e `docs/superpowers/specs/2026-07-06-foco-do-dia-design.md`).
- **Ver/regerar o código de recuperação** depois da ativação — hoje só aparece
  1x. Um "gerar novo código" dentro de Gerenciar.
- **Onboarding do cadastro** — deixar claro no `/signup` o peso da palavra-chave
  (é chave de recuperação real).

## 3. Dívida técnica / limpeza

- **Remover o legado morto do diário** (confirmar com grep antes): `PinSetupForm`,
  `PinGate`, rota `app/api/diary/unlock`, `app/api/diary/lock`, e em `lib/pin.ts`
  o que ficou sem uso (`signDiaryToken`/`verifyDiaryToken`/`DIARY_COOKIE`). O
  `hashPin`/`verifyPin`/`normalizeRecovery` continuam em uso (cadastro).
- **Reconciliar `profiles.pin_hash`** — não é mais fonte de verdade do diário.
  Decidir se remove a coluna (migration) ou deixa dormente.
- **`recovery_hash` (bcrypt) do cadastro** hoje não é lido por nada — decidir se
  usa (ex.: validar a palavra-chave na ativação) ou remove.
- **Testes automatizados** — os e2e de cripto/cadastro estão em scratchpad;
  portar pra um `test/` de verdade no repo.
- **Usuários legados com PIN antigo** — o diário deles abre em texto puro até
  ativarem o modo privado (comportamento esperado, mas comunicar).

## 4. Feito (já no `main`)

- **Foco do dia** — nota diária opt-in de foco (overlay convite → ativa → concluída
  com duração). Tabela `focus_quests` (RLS own-row) + `focus_quest_enabled` em
  `profiles`, toggle no `/config`, conteúdo i18n pt+en. Migração `0025` roda à mão.
  Spec/plano em `docs/superpowers/`.
- **Toube** — assistente de IA muito além do MVP: chat em `/toube` + painel
  flutuante, histórico por sessão (RLS), **age** nos módulos (finanças, rotina,
  lembretes, notas, dieta, treino), **lê** os dados, monta **planos de treino**,
  transcreve voz (Whisper) e lê imagens (visão). GLM-4.7-Flash (Z.ai) no chat,
  gpt-oss-120b (Groq) nos planos. **Diário é intocável pelo Toube.**
- Cadastro `/signup` (email+senha+nome+palavra-chave, sem confirmação de email).
- Diário **zero-knowledge**: cifra client-side (AES-GCM), DEK trancada por 3
  portas (PIN, palavra-chave, código). Ativar / destrancar / trocar PIN /
  desligar. PIN opcional. Servidor só guarda ciphertext.
- Vercel Analytics + Speed Insights (código).
- Finanças: botão Resetar.
- Qualidade visual (tiers), som de fundo, leitor `/leitura`.

## 5. Decisões e riscos conhecidos

- **Perder PIN + palavra-chave + código = anotações perdidas pra sempre.** É o
  preço do "nem eu leio" (zero-knowledge). Avisado na ativação.
- **`beforeunload` no modo privado é best-effort** — a cifra é assíncrona e pode
  não terminar ao fechar a aba no meio da digitação; o autosave (1,2s) cobre o
  caso normal.
- **A DEK vive em `sessionStorage`** (só na aba; some ao fechar). Trancar =
  esquecer a DEK.
