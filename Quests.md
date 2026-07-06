# Quests — Nota de Foco do Dia

> **Status:** IMPLEMENTADO como **"Foco do dia"** (jul/2026). Design e plano em
> `docs/superpowers/specs/2026-07-06-foco-do-dia-design.md` e
> `docs/superpowers/plans/2026-07-06-foco-do-dia.md`. Este arquivo é o rascunho
> original que originou a feature. **Pendente:** aplicar a migração `0025` no
> Supabase SQL Editor + QA no navegador.
> **Objetivo de produto:** que TODO usuário se sinta bem usando o Touvie —
> encorajamento + senso de progresso, de forma nítida.

## A ideia

Função opt-in (liga no `/config`) que transforma a abertura do app num pequeno
ritual de foco e autoafirmação:

1. **Ao entrar / logar**, surge uma nota sutil e bonita no canto.
2. A nota traz **palavras de autoafirmação** (encorajamento, pra alegrar) + uma
   **pergunta** que varia mas tem o mesmo sentido:
   - "O que você quer fazer hoje?" · "Qual seria o seu foco no momento?" · …
3. O usuário **escreve** o objetivo/tarefa do momento.
4. Isso vira uma **quest flutuante** na lateral (flutua sutil, sempre à vista).
5. Ao concluir, **clica em finalizar**.
6. O app **parabeniza**: mensagem de autoajuda + **tempo que levou** +
   enquadramento ("isso é uma fração do tempo que você investe pra trilhar o
   caminho do seu futuro e melhorar sua vida em geral").

## Estados

- **Sem quest hoje** → convite (autoafirmação + pergunta + campo de texto).
- **Quest ativa** → balão/quest flutua na lateral com o texto + botão finalizar
  (guarda `started_at`).
- **Concluída** → parabéns (mensagem + duração formatada); marca `completed_at`.

## Persistência (Supabase)

Nova tabela `focus_quests` (nomes a confirmar):

| coluna | tipo | nota |
| --- | --- | --- |
| id | uuid pk | `gen_random_uuid()` |
| user_id | uuid | FK `auth.users`, RLS dono |
| text | text | o que o usuário escreveu |
| prompt | text | a pergunta exibida (histórico) |
| started_at | timestamptz | `default now()` |
| completed_at | timestamptz | null até finalizar |
| created_at | timestamptz | `default now()` |

- RLS own-row (select/insert/update/delete), espelhando `user_reminders`.
- Server actions pra criar/finalizar, espelhando `components/reminders/actions.ts`.
- Toggle no `/config`: preferência `focus_quest_enabled`
  (em `profiles` p/ cross-device, OU localStorage como o `StarsToggle` — decidir).

## Onde pluga

- Overlay global no app logado (`app/(app)/layout.tsx`): client component
  `FocusQuest`, renderiza só se a preferência estiver ligada.
- "Entrar/login" = mount do app logado (1ª visita do dia / da sessão).
- Config: novo card/toggle espelhando `app/(app)/config/StarsToggle.tsx`.
- Linguagem visual: glass + navy/ouro do tema `royal`; motion via `<Reveal>` e
  os tokens `--ease-*`.

## Conteúdo (redigir — banco GRANDE de exemplos)

- **Autoafirmações** (rotativas, muitas): encorajamento leve e caloroso.
- **Perguntas** (variam, mesmo sentido): "O que você quer fazer hoje?", "Qual
  seu foco agora?", …
- **Parabéns** (na finalização): celebra + mostra `{duração}` + enquadra como
  fração do caminho rumo ao futuro.

## Decisões em aberto (resolver no início da implementação)

- [ ] **Frequência:** toda entrada/login vs **1×/dia** (não repete se já
      respondeu hoje).
- [ ] **Quest em aberto:** se não finalizou, continua voando no dia seguinte ou
      zera por dia?
- [ ] **Mensagens:** usuário passa tom/exemplos OU eu gero o banco e ele poda.
- [ ] **Relação com /notas:** função dentro do módulo Notas ou overlay separado.
- [ ] **Nome:** "Quest de foco" / "Foco do dia" / "Norte do dia" / …
- [ ] **Toggle:** preferência em `profiles` (cross-device) vs localStorage.

## Princípios

- Sutil e bonito. Encorajador, **nunca cobrador** (sem culpa se não finalizar).
- O senso de "progresso e tempo bem investido" tem que ser **nítido**.
