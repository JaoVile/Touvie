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
  Vale testar que anônimo é barrado (feito em `security/rls-anon.spec.ts`) e, no
  futuro, que um usuário não vê dado de outro.
- **Device confiável:** em produção, POST/PUT/DELETE de device não-confiável são
  bloqueados (403 `read_only_device`). Em **dev/localhost o notebook é confiável
  implicitamente** — então CRUD em `localhost:3007` funciona sem lidar com isso.

## Cobertura atual (v1) e o que falta
- ✅ `smoke.spec.ts` — cada módulo abre sem erro pra usuário logado.
- ✅ `security/rls-anon.spec.ts` — anônimo é redirecionado pro /login.
- ✅ `a11y/a11y.spec.ts` — axe (WCAG) em telas-chave, falha só em crítico/sério.
- ⏳ **A GERAR (CRUD por módulo):** criar→editar→apagar 1 fluxo feliz em cada
  módulo (notas, finanças, metas, rotina, treino, dieta), cada teste limpando o
  que criou. É o próximo alvo do generator.
- ⏳ RLS cross-user (user≠dono → deve negar) — precisa de 2º usuário de teste.
