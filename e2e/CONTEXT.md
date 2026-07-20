# Contexto do app pra testes E2E (Touvie)

Referência pro subagente `testador` e pra quem escrever specs. O DOM não conta
essas regras de domínio — sem elas, os testes ficam rasos ou erram.

## Como rodar
- Dev server: `pnpm dev` → **http://localhost:3007** (porta FIXA, não 3000).
- Testes: `pnpm test:e2e` (headless) · `pnpm test:e2e:ui` (interativo) · `pnpm test:e2e:report`.
- O Playwright reusa o dev server se já estiver no ar; senão sobe sozinho.

## Autenticação nos testes
- Login é **email + senha** (`signInWithPassword`). O `e2e/global-setup.ts` loga
  UMA vez com o usuário de teste (`.env.test`: `TEST_USER_EMAIL`/`TEST_USER_PASSWORD`)
  e salva a sessão em `e2e/.auth/user.json`. Todos os testes reusam.
- Pra testar como **anônimo**, sobrescreva: `test.use({ storageState: { cookies: [], origins: [] } })`.
- **Nunca** hardcode credenciais nos specs — sempre via `.env.test`.

## Módulos (rotas logadas)
`/` (dashboard) · `/financas` · `/treino` · `/dieta` · `/metas` · `/rotina` ·
`/notas` · `/leitura` · `/toube` (assistente IA) · `/notificacoes` · `/busca` ·
`/config` · `/diario` (PIN).

## Regras de domínio (NÃO violar)
- **Dinheiro é sempre em CENTAVOS (int).** A UI exibe via `formatBRL`. Ao asserir
  valores, lembre que o input do usuário é em reais mas o storage é centavos.
- **⚠️ O DIÁRIO é INTOCÁVEL.** É zero-knowledge (cifrado no cliente). NÃO tente
  ler/decriptar `journal_entries` nem escrever conteúdo. Teste só o **comportamento
  do gate de PIN** (pede PIN, lockout após erros — `pin_attempts`/`pin_locked_until`),
  nunca o conteúdo. Sem PIN real hardcoded.
- **Segurança/RLS é o foco central:** todo dado é escopado por `user_id` com RLS.
  Testado em dois níveis: anônimo é barrado (`security/rls-anon.spec.ts`) e um
  usuário logado não vê dado de outro (`security/rls-cross-user.spec.ts`).
- **Device confiável:** em produção, POST/PUT/DELETE de device não-confiável são
  bloqueados (403 `read_only_device`). Em **dev/localhost o notebook é confiável
  implicitamente** — então CRUD em `localhost:3007` funciona sem lidar com isso.

## Rodar sem flake (importante)
- Máquina tem ~14Gi RAM. **NÃO deixe dois `pnpm dev` competirem** — o Playwright
  tenta subir um se não achar (config `reuseExistingServer: true`); garanta UM
  server no ar em `:3007` ANTES de rodar, senão dá OOM (exit 137).
- O server é COMPARTILHADO; rodar com muitos workers satura e dá timeout nos
  fluxos de vários passos (CRUD). Rode com **`--workers=1`** (ou 2) pra suíte
  estável: `pnpm exec playwright test --workers=1`.
- ⚠️ **Rode em LOTES nesta máquina (14Gi).** A suíte INTEIRA de uma vez (~3min+)
  acumula memória e pode DERRUBAR o dev server (OOM) no fim — os testes finais
  falham por "server fora", não por bug. Rode por pasta:
  `pnpm exec playwright test e2e/smoke.spec.ts --workers=1` (e assim os demais).

## Cobertura atual e o que falta
- ✅ `smoke.spec.ts` — cada módulo abre sem erro pra usuário logado.
- ✅ `security/rls-anon.spec.ts` — anônimo é redirecionado pro /login.
- ✅ `security/rls-cross-user.spec.ts` — dois usuários LOGADOS (A e B): B cria dado
  (nota/meta/lançamento) e A NÃO o enxerga (na lista e, em notas, nem indo direto na
  URL pelo id). Usa 2 contextos de browser (um storageState por user). **Precisa do
  2º usuário** (`TEST_USER2_*` no `.env.test`); sem `e2e/.auth/user2.json` o grupo se
  pula sozinho.
- ✅ `security/diario-pin-gate.spec.ts` — gate ZK do Diário (só COMPORTAMENTO,
  conteúdo INTOCÁVEL): PIN errado → "PIN incorreto." e segue trancado; PIN certo →
  destranca (aparece o editor). Cobaia = teste2, com PIN de TESTE conhecido setado
  pelo próprio spec (beforeAll ativa o modo privado 1x, idempotente). ⚠️ o gate VIVO
  é client-side (unwrapDEK) e NÃO tem lockout/`pin_attempts` — isso é da rota legada
  `/api/diary/unlock`, hoje órfã da UI (PinGate/PinSetupForm não são renderizados).
- ✅ `a11y/a11y.spec.ts` — axe (WCAG) em telas-chave, falha só em crítico/sério.
- ✅ `crud/notas.spec.ts` — criar→editar(autosave)→apagar.
- ✅ `crud/metas.spec.ts` — meta e tarefa: criar→editar→concluir→reativar→apagar.
- ✅ `crud/financas.spec.ts` — lançamento: criar→editar(inline)→apagar (a UI de
  editar foi adicionada — antes era gap).
- ✅ `crud/contas.spec.ts` — conta a pagar: criar→editar→apagar + marcar paga
  (gera lançamento linkado por bill_id) → desmarcar → apagar.
- ✅ `crud/caixinhas.spec.ts` — orçamento: criar→editar→apagar (UNIQUE por cat+mês).
- ✅ `crud/rotina.spec.ts` — bloco diário: criar→editar(horário via TimePicker)→apagar.
- ✅ `crud/dieta.spec.ts` — medida do corpo: criar→editar(inline)→apagar.
- ✅ `crud/treino.spec.ts` — exercício e programa: criar→editar(inline)→apagar.
- ✅ `crud/treino-log.spec.ts` — log de série (cadeia funda `exercise_logs`): cria
  exercício → abre a sessão de hoje (StartSessionButton) → adiciona exercício ad-hoc
  no SessionLogger → registra série (peso/reps/RPE) → aparece na lista → apaga a
  série (× "Apagar série"). Limpa no afterEach (apaga a sessão do dia — cascata nos
  logs — e depois o exercício). ⚠️ gap: NÃO há UI de editar-in-place um set (só
  apagar+re-registrar), embora `saveLog` suporte update por id.
- ✅ `crud/dieta-refeicoes.spec.ts` — refeições do dia (cadeia funda foods→meals→
  meal_items): cria alimento no catálogo (/dieta?t=alimentos) → no card "Café da
  manhã" adiciona item (select + gramas → "+") → confere item (`N g · N kcal`) e a
  soma de macros no header → persiste após reload → remove item. Limpa respeitando
  a FK: apaga a refeição (cascata nos itens) ANTES do alimento (food_id é RESTRICT).
- ✅ `crud/rotina-semanal.spec.ts` — grade Semanal (`routine_weekly`): no card de um
  dia (ex.: Segunda), "Adicionar" abre o WeeklyForm (TimePicker default 07:00 + título)
  → "Salvar" cria o bloco → aparece no dia com o horário → persiste após reload →
  apaga (× confirm "Apagar?"). NÃO há editar in-place na Semanal (só criar+apagar).
- ✅ **CRUD dos módulos + cadeias fundas coberto.** Próximos alvos (não-gate):
  regressão visual (screenshots) e Web Vitals reais por rota.
