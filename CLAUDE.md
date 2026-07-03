# Touvie — guia de desenvolvimento

Life OS pessoal (rotina, metas, diário, finanças, treino, dieta) em Next.js 15.
**Visão de produto, módulos e decisões de arquitetura estão no [README](./README.md)**;
setup passo a passo em [docs/OPERATIONS.md](./docs/OPERATIONS.md). Este arquivo é o
manual de **como trabalhar no código** — comandos, convenções e armadilhas.

## Comandos (pnpm — não use npm/yarn)
| Comando | O que faz |
|---|---|
| `pnpm dev` | Dev server em **http://localhost:3007** (porta fixa, não 3000) |
| `pnpm check` | Biome lint+format com autofix (`biome check --write .`) — **rode antes de commitar** |
| `pnpm lint` | Só checa, sem escrever (`biome check .`) |
| `pnpm build` | Build de produção |
| `pnpm fetch:sounds` | Baixa os assets de soundscape (`scripts/fetch-sounds.mjs`) |

**Não há suíte de testes automatizados.** O portão de qualidade é:
`pnpm check` + `pnpm exec tsc --noEmit` (typecheck) + `pnpm build`.

## Mapa do código
```
app/
  (marketing)/landpage   — página pública (visitante anônimo cai aqui via rewrite em /)
  (auth)/login,signup    — autenticação
  (app)/…                — módulos logados: rotina, metas, diario, financas,
                           treino, dieta, notas, leitura, config, notificacoes, busca
  api/{diary,telegram,cron,search}  — route handlers
lib/
  supabase/{client,server,admin,middleware,types}.ts  — um por contexto (ver abaixo)
  <dominio>.ts           — regras de cada módulo (finance, workout, diet, diary-crypto, pin…)
components/              — UI compartilhada
messages/               — traduções i18n (pt + en) do next-intl
supabase/migrations/    — schema versionado (.sql numerados)
```

## Convenções de código
O Biome cuida do **formato** (2 espaços, aspas duplas, ponto-e-vírgula sempre,
trailing comma, largura 100, imports organizados) — é só rodar `pnpm check`. As
convenções que o Biome **não** garante:

- **Dinheiro é sempre em CENTAVOS (int).** Use `formatBRL(cents)` de `lib/utils.ts`
  pra exibir (ele divide por 100). Nunca guarde reais como float.
- **Classes CSS:** sempre via `cn(...)` (`lib/utils.ts`, = clsx + tailwind-merge).
  Variantes de componente com **cva**; ícones com **lucide-react**.
- **Evite `any`** (Biome marca como warning). Prefira os tipos gerados do Supabase
  em `lib/supabase/types.ts`.
- **Cliente Supabase certo por contexto:** `client.ts` (browser), `server.ts`
  (Server Components/Actions, respeita RLS), `admin.ts` (service_role, **bypassa RLS
  — só server, nunca em código que chega ao browser**).
- **Textos visíveis vão pra `messages/`** (pt + en), não hardcoded no JSX.
- Server Components por padrão; mutação por **Server Actions** / route handlers.

## ⚠️ Gotchas (leia antes de editar)
- **Middleware de dispositivo confiável** (`middleware.ts`): em **produção**, métodos
  mutantes (POST/PUT/DELETE/PATCH) são bloqueados (403 `read_only_device`) se o
  device não tiver o cookie assinado. Em dev o notebook é confiável implicitamente.
  → Se criar uma rota que **precisa** escrever de um device não-confiável (ex: gate
  de PIN no celular), adicione o prefixo em `TRUST_BYPASS_PREFIXES`.
- **Rotas de sistema** `/api/cron/*` e `/api/telegram/*` pulam a checagem de auth do
  middleware — elas se autenticam por conta própria via `Bearer $CRON_SECRET`.
- **Diário tem PIN de dois níveis** (ler ≠ escrever) com **rate limit no banco**
  (`pin_attempts`/`pin_locked_until`). Toda validação de PIN é server-side —
  nunca mova pro client.
- **Crons são híbridos:** os 2 críticos ficam em `vercel.json` (limite do plano
  Hobby); os demais num scheduler externo. O cron financeiro mensal é blindado
  server-side pra só disparar no dia certo.
- **Migrations rodam manualmente** no SQL Editor do Supabase, em ordem numérica
  (`supabase/migrations/`). Não há CLI de migration automatizada aqui.
- **Tailwind v4 (beta)** + PostCSS — sintaxe/config diferem da v3.
- **Worktrees:** existe um git worktree em `.claude/worktrees/` pra trabalho isolado.
  Não confundir com a árvore principal ao buscar/editar arquivos.

## Ambiente
Copie `.env.local.example` → `.env.local` e preencha. Segredos (`TRUSTED_DEVICE_SECRET`,
`CRON_SECRET`) se geram com `openssl rand -base64 32`. Detalhes em `docs/OPERATIONS.md`.
