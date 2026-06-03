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

## 🧭 Estado atual (atualizado 2026-06-03)

Tudo na `main`, buildando e deployado na Vercel. Migrations aplicadas até **0015**.

**Em foco agora: upgrade do financeiro.** Os 3 essenciais estão fechados (pagar
fatura, receita recorrente, ajustar saldo) e a criação de conta foi simplificada
("um total só" — um saldo geral em vez de várias contas, pensado pra uso real).

### ✅ Já feito nesta leva
- Pagar conta → gera lançamento que abate o saldo
- Pagar fatura do cartão + parcelamento
- **Receita recorrente**: botão "Recebi"/"Lançar" + cron `/api/cron/post-recurring`,
  idempotência via `external_ref = rec:<id>:<mês>` (sem migration nova)
- Ajustar saldo manual
- Criação de conta simplificada: atalhos + picker visual + opções avançadas ocultas
- Modelo "um total só" (commit `0b0efc1`)

### 🔜 Pra terminar no trabalho
1. **Colar a URL do cron no cron-job.org** apontando pra `/api/cron/post-recurring`
   (header `Authorization: Bearer $CRON_SECRET`) — sem isso a receita recorrente
   não posta sozinha. É o único passo pendente da feature.
2. **Polimento do financeiro** — não sobrou nenhuma feature grande, só acabamento
   (revisar telas, microcopy, estados vazios).
3. Opcional/depois: **segredo de escrita do diário** (destravar escrita via PIN de
   4 dígitos no `/config`) — ainda NÃO começado; usar migration `0016+`.

> ⚠️ Não rode `pnpm build` com o `pnpm dev` ativo (compartilham `.next` → 500).
> Pra checar tipos use `pnpm tsc --noEmit`. Testar build sempre com **pnpm**.

## 🛠️ Scripts

```bash
pnpm dev        # desenvolvimento local (Turbopack)
pnpm build      # build de produção
pnpm start      # roda build local
pnpm check      # lint + format (Biome)
```
