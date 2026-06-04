# Rotina — seu life OS pessoal

App web privado pra organizar rotina, metas, manifestação, finanças, treino e dieta.
Stack: **Next.js 15 + Supabase + Vercel + Telegram bot**.

## 🚀 Setup inicial (faz uma vez)

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Criar projeto no Supabase

1. Acessa https://supabase.com/dashboard e cria um projeto novo (região `South America (São Paulo)`)
2. Anota a senha do banco — você vai precisar
3. Vai em **Settings → API** e pega:
   - `Project URL` → vai virar `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (NUNCA exponha publicamente)

### 3. Rodar as migrations

No dashboard do Supabase, **SQL Editor** → **New query**. Roda em ordem:

1. `supabase/migrations/0001_initial_schema.sql` (schema base)
2. `supabase/migrations/0002_workout.sql` (P5 — treino: junction table + view de PRs)

### 4. Criar o usuário

**Authentication → Users → Add user → Create new user**. Use seu email + senha.
O trigger cria o `profile` automaticamente.

### 5. Configurar variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Preenche `.env.local` com os valores acima, e gera os segredos:

```bash
# Gera TRUSTED_DEVICE_SECRET e CRON_SECRET (cada um uma vez)
openssl rand -base64 32
```

### 6. Rodar localmente

```bash
pnpm dev
```

Acessa http://localhost:3000, faz login. No notebook, marca **"Confiar neste dispositivo"**.

## 📦 Deploy no Vercel

1. Cria repositório no GitHub e dá push
2. Acessa https://vercel.com, importa o repo
3. Em **Settings → Environment Variables**, adiciona:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TRUSTED_DEVICE_SECRET`
   - `CRON_SECRET`
   - `TELEGRAM_BOT_TOKEN` (do @BotFather)
   - `TELEGRAM_WEBHOOK_SECRET` (qualquer string aleatória)
4. Deploy. Os dois crons em `vercel.json` são ativados automaticamente (plano Hobby permite 2).
5. Abre `/config`, clica em "Conectar bot" e manda `/start` no bot.

## 📱 Fluxo de uso

- **Notebook**: login + "Confiar neste dispositivo" → pode editar tudo
- **Celular**: login normal → tudo fica **somente leitura** (protegido pelo middleware)
- **Diário**: quando ativado (Fase 2), exige PIN adicional, independente do dispositivo

## 🎨 Trocar tema

Em `/config` → seletor visual. Temas disponíveis: `glass-purple`, `dark-minimal`, `notion-clean`.

**Pra criar um tema novo**:
1. Cria `app/themes/meu-tema.css` com overrides das variáveis CSS (copia um existente)
2. Importa em `app/globals.css`
3. Adiciona a entrada em `lib/themes.ts`
4. Seleciona em `/config`

## 📅 Fases de entrega

- **P1** — scaffold + auth + rotina + metas ✅
- **P2** — diário com PIN + editor scripting + autosave ✅
- **P3** — finanças completo + gráficos ✅
- **P4** — bot Telegram + crons de lembrete ✅
- **P5** — treino avançado (séries, PRs, progressão) ✅
- **P6** — dieta (refeições, macros, medidas) ✅

## 🧭 Estado atual (atualizado 2026-06-04)

Tudo na `main`, buildando e deployado na Vercel. Migrations aplicadas até **0015**.

**Financeiro no modelo "um total só".** Acabou o conceito de banco/conta na UI:
existe UM saldo total (soma de tudo). O commit `0b0efc1` simplificou o módulo
pensando em disponibilizar o app — e nessa leva foram **removidos** o cartão de
crédito (fatura/parcelas), a aba Importar e a **receita recorrente** (junto com o
cron `/api/cron/post-recurring`, que **não existe mais**). Abas atuais:
Lançamentos · Contas · Caixinhas · Gráficos · Setup.

### ✅ Funcionando hoje
- Lançamentos simples (entrou/saiu + valor + data + categoria + descrição)
- Contas a pagar: marcar pago abate direto do saldo total
- Ajustar saldo manual (gera lançamento de ajuste pela diferença)
- Caixinhas (envelopes de orçamento) + Gráficos
- Cron `regenerate-bills` (mensal) regenera as bills recorrentes do próximo mês
- Bot Telegram: `/gasto`, `/receita`, `/saldo` (corrigidos — usavam tabela errada)

### ✅ Resolvido nesta leva (2026-06-04)
- **Tipos do Supabase reais**: `lib/supabase/types.ts` cobre todas as tabelas/views
  e o `<Database>` está plugado nos 3 clients (admin/server/browser) — `tsc` agora
  pega nome de tabela/coluna errado. Exigiu subir `@supabase/ssr`→`^0.10` e
  `supabase-js`→`^2.107`. Já pegou um bug latente (`exercise_logs.created_at` ghost).
- **Rota `/sandbox/circle-text` removida.**
- **PWA**: ícones PNG 192/512 + apple-touch-icon (gerados via `scripts/gen-icons.mjs`).

### 🔜 Pendências
1. **Aplicar migrations no Supabase de produção** (SQL Editor):
   `0016_drop_transfers.sql` (dropa a tabela órfã `transfers`, vazia — recria a view
   sem os termos dela antes do drop).
2. **Crons de lembrete sem scheduler.** Só `regenerate-bills` está na `vercel.json`.
   `daily-reminders` (08:00), `evening-reminders` (20:00), `training-reminder` e
   `work-clock` (4 tipos) precisam ser agendados no **cron-job.org** (header
   `Authorization: Bearer $CRON_SECRET`) — senão os lembretes do bot nunca disparam.
3. Opcional/depois: **segredo de escrita do diário** (destravar escrita via PIN de
   4 dígitos no `/config`) — ainda NÃO começado; usar migration `0017+` (a 0016 já
   foi usada pelo drop de `transfers`).

> ⚠️ Não rode `pnpm build` com o `pnpm dev` ativo (compartilham `.next` → 500).
> Pra checar tipos use `pnpm tsc --noEmit`. Testar build sempre com **pnpm**.

## 🛠️ Scripts

```bash
pnpm dev        # desenvolvimento local (Turbopack)
pnpm build      # build de produção
pnpm start      # roda build local
pnpm check      # lint + format (Biome)
```
