export type TemplateDefault = {
  key: string;
  name: string;
  content: string;
};

export const WORK_CLOCK_DEFAULTS: TemplateDefault[] = [
  {
    key: "work-clock:clock-in-morning",
    name: "Ponto — Entrada manhã",
    content: "⏰ <b>BATER PONTO</b>\n\nBom dia! Hora de iniciar o expediente.",
  },
  {
    key: "work-clock:lunch-break",
    name: "Ponto — Saída almoço",
    content: "🍽️ <b>PAUSAR PARA O ALMOÇO</b>\n\nHora do almoço — bater ponto de saída.",
  },
  {
    key: "work-clock:clock-in-afternoon",
    name: "Ponto — Entrada tarde",
    content: "⏰ <b>BATER PONTO NOVAMENTE</b>\n\nVolta do almoço — bater ponto de entrada.",
  },
  {
    key: "work-clock:clock-out",
    name: "Ponto — Saída",
    content: "🏁 <b>FINALIZAR PONTO</b>\n\nFim do expediente — bater ponto de saída.",
  },
];

// Espelham o ciclo da migration 0036 (Upper/Lower 2× — Ciclo 2026-08).
// Convenção do ciclo: 2 séries de TRABALHO (aquecimento não é volume prescrito)
// e reps como PISO, não faixa — por isso número único, nunca "8-10".
// ⚠️ Ao mudar o programa no app, estes textos NÃO acompanham sozinhos: o cron
// training-reminder lê `notification_templates` (banco) e só cai neste arquivo
// como fallback. Editar aqui exige propagar pro banco (migration/aba Templates).
export const TRAINING_DEFAULTS: TemplateDefault[] = [
  {
    key: "training:monday",
    name: "Treino — Segunda (Superior A)",
    content: `🏋️‍♂️ <b>SEGUNDA · SUPERIOR A</b>
<i>2 séries de trabalho · reps é piso</i>
━━━━━━━━━━━━━━━━━━

<b>① Panturrilha em pé</b>
    ➜ <code>2 × 10</code>

<b>② Supino reto com barra</b>  ·  <i>força</i>
    ➜ <code>2 × 5</code>

<b>③ Remada curvada</b>
    ➜ <code>2 × 6</code>

<b>④ Supino inclinado com halteres</b>
    ➜ <code>2 × 8</code>

<b>⑤ Puxada alta pronada</b>
    ➜ <code>2 × 8</code>

<b>⑥ Elevação lateral</b>
    ➜ <code>2 × 12</code>

<b>⑦ Tríceps testa</b>
    ➜ <code>2 × 8</code>

<b>⑧ Rosca direta</b>
    ➜ <code>2 × 8</code>

💪 Bom treino!`,
  },
  {
    key: "training:tuesday",
    name: "Treino — Terça (Inferior A)",
    content: `🦵 <b>TERÇA · INFERIOR A</b>
<i>2 séries de trabalho · reps é piso</i>
━━━━━━━━━━━━━━━━━━

<b>① Panturrilha em pé</b>
    ➜ <code>2 × 10</code>

<b>② Agachamento livre</b>  ·  <i>força</i>
    ➜ <code>2 × 5</code>

<b>③ Leg press 45°</b>
    ➜ <code>2 × 10</code>

<b>④ Mesa flexora</b>
    ➜ <code>2 × 10</code>

<b>⑤ Cadeira extensora</b>
    ➜ <code>2 × 12</code>

<b>⑥ Abdominal (elevação de pernas)</b>
    ➜ <code>2 × 10</code>

💪 Bom treino!`,
  },
  {
    key: "training:wednesday",
    name: "Treino — Quarta (Leve)",
    content: `🌤️ <b>QUARTA · LEVE</b>
<i>ombro, core e cardio — não é dia de puxar carga</i>
━━━━━━━━━━━━━━━━━━

<b>① Panturrilha sentado</b>
    ➜ <code>2 × 12</code>

<b>② Elevação lateral</b>
    ➜ <code>2 × 12</code>

<b>③ Crucifixo inverso</b>
    ➜ <code>2 × 15</code>

<b>④ Pallof press</b>
    ➜ <code>2 × 10</code>  ·  <i>10 por lado</i>

<b>⑤ Rotação externa (manguito)</b>
    ➜ <code>2 × 15</code>

<b>⑥ Mobilidade quadril + torácica</b>
    ➜ <code>5 min</code>

<b>⑦ Cardio zona 2</b>
    ➜ <code>20-25 min</code>  ·  <i>ritmo de conversa</i>

⚙️ <b>RECOVERY</b>
• Hidrata mais que normal
• Proteína no jantar (1g/kg mínimo)
• Dormir cedo — quinta vem SUPERIOR B forte

🌤️ Bom treino!`,
  },
  {
    key: "training:thursday",
    name: "Treino — Quinta (Superior B)",
    content: `💪 <b>QUINTA · SUPERIOR B</b>
<i>2 séries de trabalho · reps é piso</i>
━━━━━━━━━━━━━━━━━━

<b>① Panturrilha sentado</b>
    ➜ <code>2 × 12</code>

<b>② Barra fixa</b>
    ➜ <code>2 × 6</code>
    <i>Se não fechar 6 na 1ª série, troca por puxada supinada na máquina</i>

<b>③ Supino inclinado com halteres</b>
    ➜ <code>2 × 8</code>

<b>④ Remada baixa na polia</b>
    ➜ <code>2 × 8</code>

<b>⑤ Crossover na polia</b>
    ➜ <code>2 × 12</code>

<b>⑥ Desenvolvimento com halteres</b>
    ➜ <code>2 × 8</code>

<b>⑦ Crucifixo inverso</b>
    ➜ <code>2 × 15</code>

<b>⑧ Rosca inclinada</b>
    ➜ <code>2 × 10</code>

<b>⑨ Tríceps na corda</b>
    ➜ <code>2 × 12</code>

💪 Bom treino!`,
  },
  {
    key: "training:friday",
    name: "Treino — Sexta (Inferior B)",
    content: `🍑 <b>SEXTA · INFERIOR B</b>
<i>2 séries de trabalho · reps é piso</i>
━━━━━━━━━━━━━━━━━━

<b>① Panturrilha em pé</b>
    ➜ <code>2 × 10</code>

<b>② Levantamento terra romeno</b>  ·  <i>força</i>
    ➜ <code>2 × 6</code>

<b>③ Agachamento búlgaro</b>
    ➜ <code>2 × 8</code>  ·  <i>cada perna</i>

<b>④ Mesa flexora</b>
    ➜ <code>2 × 10</code>

<b>⑤ Elevação pélvica (hip thrust)</b>
    ➜ <code>2 × 8</code>

<b>⑥ Cadeira extensora</b>
    ➜ <code>2 × 12</code>

<b>⑦ Abdominal na polia (rosca abdominal)</b>
    ➜ <code>2 × 10</code>

💪 Bom treino — fim de semana liberado!`,
  },
  {
    key: "training:saturday",
    name: "Treino — Sábado (Descanso)",
    content: `🛋️ <b>SÁBADO · DESCANSO</b>
━━━━━━━━━━━━━━━━━━

Recuperação ativa, não preguiça.

⚙️ <b>HOJE</b>
• 8h de sono &gt; qualquer suplemento
• Caminhada leve 20-30min (opcional)
• Refeições com proteína espalhadas no dia
• Mobilidade de quadril e ombro

<i>Próximo treino: segunda — SUPERIOR A.</i>`,
  },
  {
    key: "training:sunday",
    name: "Treino — Domingo (Descanso + Planning)",
    content: `🛋️ <b>DOMINGO · DESCANSO</b>
━━━━━━━━━━━━━━━━━━

Última recuperação antes da semana.

⚙️ <b>PLANEJA AGORA</b>
• Pesa hoje (em jejum, depois do banheiro)
• Confere progressão da semana — onde subiu carga?
• Prepara as marmitas
• Dorme cedo

<i>Próximo treino: segunda — SUPERIOR A.</i>`,
  },
];

export const CRON_DEFAULTS: TemplateDefault[] = [
  {
    key: "cron:morning",
    name: "Cron — Lembrete da manhã",
    content: `{{greeting}}

{{daily_routine}}

{{weekly_blocks}}

{{bills_today}}

{{pending_tasks}}

{{pinned_notes}}`,
  },
  {
    key: "cron:evening",
    name: "Cron — Lembrete da noite",
    content: `{{greeting}}

{{tasks_due_tomorrow}}

{{upcoming_bills_3d}}

{{tomorrow_recurrences}}

{{weekly_recap}}

{{sunday_scripting}}`,
  },
  {
    key: "cron:monthly-finance",
    name: "Cron — Fluxo financeiro mensal",
    content: `📅 <b>{{month_label}}</b>

{{month_summary}}

{{tx_count}}

{{top_expense_categories}}`,
  },
];

export const ALL_DEFAULTS: TemplateDefault[] = [
  ...WORK_CLOCK_DEFAULTS,
  ...TRAINING_DEFAULTS,
  ...CRON_DEFAULTS,
];

export const CRON_FALLBACK: Record<string, string> = Object.fromEntries(
  CRON_DEFAULTS.map((t) => [t.key, t.content]),
);

export const WORK_CLOCK_FALLBACK: Record<string, string> = Object.fromEntries(
  WORK_CLOCK_DEFAULTS.map((t) => [t.key.replace("work-clock:", ""), t.content]),
);

const WEEKDAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
export const TRAINING_FALLBACK: Record<number, string> = Object.fromEntries(
  TRAINING_DEFAULTS.map((t) => {
    const day = WEEKDAY_KEYS.indexOf(t.key.replace("training:", ""));
    return [day, t.content];
  }),
);
