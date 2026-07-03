// Catálogo público das variáveis dos templates de cron.
// Usado pela UI pra mostrar quais variáveis estão disponíveis em cada
// template (e oferecer click-to-insert). A definição funcional (o que
// cada variável renderiza) vive em `lib/notifications/variables.ts` —
// este arquivo só carrega nome+descrição+exemplo e é safe pro client
// porque não importa supabase/admin.

export type VarDescriptor = {
  name: string;
  description: string;
  example: string;
};

export type CronTemplateKey = "cron:morning" | "cron:evening" | "cron:monthly-finance";

export const VAR_CATALOG: Record<CronTemplateKey, VarDescriptor[]> = {
  "cron:morning": [
    {
      name: "greeting",
      description: "Saudação com o dia da semana.",
      example: "☀️ Bom dia! Hoje é segunda-feira.",
    },
    {
      name: "weekday",
      description: "Só o nome do dia da semana (sem nada em volta).",
      example: "segunda-feira",
    },
    {
      name: "date",
      description: "Data por extenso, formato brasileiro.",
      example: "08 de junho",
    },
    {
      name: "daily_routine",
      description: "Bloco com a lista da rotina diária (até 12 itens).",
      example: "📅 Rotina do dia\n• 07:00 🏋️ Treino A\n• 12:30 🍽️ Almoço\n• 22:00 📖 Leitura",
    },
    {
      name: "weekly_blocks",
      description: "Blocos semanais agendados pra hoje (manhã/tarde/noite).",
      example: "📌 Blocos de hoje\n• 💼 Reunião quinzenal (manhã)",
    },
    {
      name: "pending_tasks",
      description: "Tarefas com vencimento até hoje, ainda não feitas.",
      example:
        "✅ Tarefas pendentes (3)\n• Pagar boleto (venceu 2026-06-07)\n• Ligar pro dentista\n• Confirmar reserva",
    },
    {
      name: "bills_today",
      description: "Contas a pagar com vencimento hoje.",
      example: "🔔 Contas vencendo hoje\n• Internet — R$ 89,90",
    },
    {
      name: "pinned_notes",
      description: "Notas fixadas (pinned), até 5.",
      example: "📎 Notas fixadas\n• Senha do roteador\n• Lista de mercado",
    },
  ],
  "cron:evening": [
    {
      name: "greeting",
      description: "Saudação noturna.",
      example: "🌙 Boa noite!",
    },
    {
      name: "weekday",
      description: "Nome do dia da semana.",
      example: "domingo",
    },
    {
      name: "tomorrow_recurrences",
      description: "Lançamentos recorrentes (assinaturas, salário etc.) que caem amanhã.",
      example: "📌 Recorrências de amanhã\n• Netflix — − R$ 39,90\n• Salário — + R$ 4.500,00",
    },
    {
      name: "upcoming_bills_3d",
      description: "Contas a vencer nos próximos 3 dias (a partir de amanhã).",
      example:
        "🔔 Contas a vencer (próximos 3 dias)\n• Aluguel — R$ 1.800,00 (amanhã)\n• Luz — R$ 178,00 (em 2 dias)",
    },
    {
      name: "tasks_due_tomorrow",
      description: "Tarefas com vencimento até amanhã, não feitas.",
      example:
        "📝 Tarefas pra resolver (até amanhã)\n• Comprar passagem (2026-06-09)\n• Revisar contrato",
    },
    {
      name: "weekly_recap",
      description: "Recap de hábitos da semana — % de consistência. Só aparece no domingo.",
      example: "🥈 Recap da semana\n• Hábitos: 18/35 — 51% de consistência",
    },
    {
      name: "sunday_scripting",
      description: "Lembrete pra abrir o diário e fazer scripting. Só aparece no domingo.",
      example:
        "🔒 Domingo é dia de scripting. Abra o diário e escreva como se já tivesse acontecido.",
    },
  ],
  "cron:monthly-finance": [
    {
      name: "month_label",
      description: "Mês de referência (do dia em que o cron rodou).",
      example: "Junho 2026",
    },
    {
      name: "month_summary",
      description: "Receitas, despesas e saldo do mês corrente.",
      example:
        "💰 Fluxo do mês\n• Receitas: R$ 4.500,00\n• Despesas: R$ 2.870,40\n• Saldo: R$ 1.629,60 ✅",
    },
    {
      name: "tx_count",
      description: "Quantidade de lançamentos no mês.",
      example: "📊 42 lançamentos no mês.",
    },
    {
      name: "top_expense_categories",
      description: "Top 3 categorias de despesa do mês.",
      example:
        "🏷️ Top categorias\n• 🍔 Alimentação — R$ 920,00\n• 🚗 Transporte — R$ 540,00\n• 🎬 Lazer — R$ 310,00",
    },
  ],
};

export const CRON_TEMPLATE_KEYS = Object.keys(VAR_CATALOG) as CronTemplateKey[];

export function isCronTemplateKey(k: string): k is CronTemplateKey {
  return (CRON_TEMPLATE_KEYS as string[]).includes(k);
}
