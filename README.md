[![CI](https://github.com/JaoVile/Touvie/actions/workflows/ci.yml/badge.svg)](https://github.com/JaoVile/Touvie/actions/workflows/ci.yml)

<div align="center">

<img src="./public/brand/touvie-og.png" alt="Touvie" width="640" />

### Seu *Life OS* pessoal — rotina, metas, diário, finanças, treino e dieta num app só.

[![Ver ao vivo](https://img.shields.io/badge/▶_ver_ao_vivo-touvie.vercel.app-e3b452?style=for-the-badge&labelColor=0c1640)](https://touvie.vercel.app)
&nbsp;
[![Licença MIT](https://img.shields.io/badge/licença-MIT-0c1640?style=for-the-badge&labelColor=e3b452)](./LICENSE)

[![Next.js 15](https://img.shields.io/badge/Next.js_15-0c1640?style=flat-square&logo=nextdotjs&logoColor=e3b452)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-0c1640?style=flat-square&logo=typescript&logoColor=e3b452)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-0c1640?style=flat-square&logo=supabase&logoColor=e3b452)](https://supabase.com)
[![Tailwind](https://img.shields.io/badge/Tailwind-0c1640?style=flat-square&logo=tailwindcss&logoColor=e3b452)](https://tailwindcss.com)
[![PWA](https://img.shields.io/badge/PWA-0c1640?style=flat-square&logo=pwa&logoColor=e3b452)](https://web.dev/progressive-web-apps/)
[![Telegram Bot](https://img.shields.io/badge/Telegram_Bot-0c1640?style=flat-square&logo=telegram&logoColor=e3b452)](https://core.telegram.org/bots)

</div>

---

## O que é

**Touvie** é um *sistema operacional de vida* — um único app, privado, que reúne os módulos que normalmente ficam espalhados em cinco apps diferentes: agenda de rotina, metas, diário, controle financeiro, treino e dieta. Construído como **PWA** (instala no celular, funciona offline) com um **bot de Telegram** acoplado pra lançar gasto e consultar saldo sem abrir o app.

Não é um clone de tutorial — é um produto pessoal real, em produção na Vercel, com **18 migrations** de banco, modelo de segurança próprio e identidade visual autoral.

> **▶ Demo ao vivo:** [touvie.vercel.app](https://touvie.vercel.app)

## Módulos

| | Módulo | O que faz |
|---|---|---|
| 🗓️ | **Rotina** | Blocos de hábito/tarefa do dia com marcação de conclusão |
| 🎯 | **Metas** | Objetivos de curto e longo prazo com acompanhamento |
| 📓 | **Diário** | Entradas + humor, protegido por PIN de dois níveis (ler ≠ escrever) |
| 💰 | **Finanças** | Lançamentos, contas a pagar, caixinhas (envelopes) e gráficos |
| 🏋️ | **Treino** | Séries, cargas, recordes pessoais (PRs) e progressão |
| 🥗 | **Dieta** | Refeições, macros e medidas corporais |
| 📝 | **Notas** | Bloco de notas rápido |
| 🔔 | **Notificações** | Lembretes via Telegram com **templates editáveis pela UI** |
| 🔍 | **Busca** | Busca global entre os módulos |

## Stack & arquitetura

```
Next.js 15 (App Router, RSC)  ──┐
   ├─ middleware de auth + trust ├─►  Supabase (Postgres + RLS + Auth)
   ├─ Server Actions             │         18 migrations versionadas
   └─ Route Handlers (API)       │
                                 ├─►  Bot de Telegram (webhook)
   Tailwind + temas CSS          └─►  Crons (Vercel + externos)
   Recharts · next-intl (pt/en)
```

- **Framework:** Next.js 15 (App Router, React Server Components, Server Actions)
- **Banco/Auth:** Supabase (Postgres com Row Level Security, Auth nativo)
- **UI:** Tailwind CSS + sistema de temas trocável + Recharts pros gráficos
- **i18n:** `next-intl` com pt-BR e inglês
- **Integrações:** Bot de Telegram (webhook) + crons agendados
- **Qualidade:** TypeScript estrito com tipos do Supabase gerados, Biome (lint+format)

## Decisões técnicas que valem destacar

Estas são as partes em que o "porquê" importa mais que o "o quê":

- **Modelo de confiança por dispositivo.** O `middleware.ts` libera escrita só em dispositivos marcados como confiáveis — no celular o app fica **somente-leitura** por padrão. A confiança é um cookie assinado com **HMAC-SHA256** (`lib/crypto.ts`), validado server-side via Web Crypto pra rodar igual no edge e no node.
- **Diário com PIN de dois níveis.** Um hash destrava a *leitura*, outro destrava a *escrita* — separados de propósito, pra você poder revisitar o diário sem habilitar edição num aparelho emprestado.
- **Brute-force barrado no servidor.** O PIN tem **rate limit no banco** (`pin_attempts` + `pin_locked_until`): depois de N erros, o destrave trava por minutos. Não dá pra forçar pelo client.
- **Notificações como dados, não código.** Os lembretes do bot usam **templates no Postgres** com sintaxe `{{variavel}}` — dá pra editar o texto na UI e publicar sem deploy. Cada variável some sozinha quando não tem dado.
- **Arquitetura de crons híbrida.** Os 2 crons mais críticos ficam no `vercel.json` (limite do plano Hobby); os demais ficam num scheduler externo autenticado por `Bearer $CRON_SECRET`. O cron financeiro mensal é blindado server-side pra só disparar no dia certo.

## Rodando localmente

```bash
pnpm install
cp .env.local.example .env.local   # preencha as chaves do Supabase
pnpm dev                           # http://localhost:3007
```

O passo a passo completo — criar o projeto Supabase, rodar as 18 migrations, configurar o bot de Telegram e agendar os crons — está em **[docs/OPERATIONS.md](./docs/OPERATIONS.md)**.

## Roadmap (entregue)

- ✅ **P1** — scaffold, auth, rotina e metas
- ✅ **P2** — diário com PIN + autosave
- ✅ **P3** — finanças completo + gráficos
- ✅ **P4** — bot de Telegram + crons de lembrete
- ✅ **P5** — treino avançado (séries, PRs, progressão)
- ✅ **P6** — dieta (refeições, macros, medidas)

---

<div align="center">

Feito por **João Marcos Vilela** · [Portfólio](https://joaovilela.vercel.app) · [GitHub](https://github.com/JaoVile)

Licença [MIT](./LICENSE)

</div>