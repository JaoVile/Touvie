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

export const TRAINING_DEFAULTS: TemplateDefault[] = [
  {
    key: "training:monday",
    name: "Treino — Segunda (Upper A)",
    content: `🏋️‍♂️ <b>SEGUNDA · UPPER A</b>
<i>peito · costas · ombros · braços (modo força)</i>
━━━━━━━━━━━━━━━━━━

<b>① Flat Barbell Bench</b>  ·  <i>peito horizontal</i>
    ➜ <code>4 × 6-8</code>  ·  RIR 1-2

<b>② Pull-up</b>  ·  <i>costas vertical</i>
    ➜ <code>4 × 8-10</code>

<b>③ Overhead Press</b>  ·  <i>ombro frontal</i>
    ➜ <code>3 × 6-8</code>

<b>④ Seal Row</b>  ·  <i>costas horizontal</i>
    ➜ <code>3 × 8-10</code>

<b>⑤ Lateral Raise</b>  ·  <i>ombro lateral</i>
    ➜ <code>3 × 12-15</code>

<b>⑥ Barbell Curl</b>  ·  <i>bíceps</i>
    ➜ <code>3 × 8-10</code>

<b>⑦ Cable Pushdown</b>  ·  <i>tríceps</i>
    ➜ <code>3 × 10-12</code>

💪 Bom treino!`,
  },
  {
    key: "training:tuesday",
    name: "Treino — Terça (Lower A)",
    content: `🦵 <b>TERÇA · LOWER A</b>
<i>quadríceps · panturrilha · core</i>
━━━━━━━━━━━━━━━━━━

<b>① Squat</b>  ·  <i>quad compound</i>
    ➜ <code>4 × 6-8</code>  ·  RIR 1-2

<b>② Romanian Deadlift</b>  ·  <i>posterior</i>
    ➜ <code>3 × 8-10</code>

<b>③ Leg Extension</b>  ·  <i>quad isolation</i>
    ➜ <code>3 × 12-15</code>

<b>④ Hamstring Curl</b>  ·  <i>posterior isolation</i>
    ➜ <code>3 × 12-15</code>

<b>⑤ Standing Calf Raise</b>
    ➜ <code>4 × 12-15</code>

<b>⑥ Cable Crunch</b>  ·  <i>abs com carga</i>
    ➜ <code>3 × 10-12</code>

💪 Bom treino!`,
  },
  {
    key: "training:wednesday",
    name: "Treino — Quarta (Box/Cardio)",
    content: `🥊 <b>QUARTA · BOX</b>
━━━━━━━━━━━━━━━━━━

Hoje o BOX cobre cardio, ombro frontal e core.
Foca <b>técnica</b> — não é dia de puxar carga.

⚙️ <b>RECOVERY</b>
• Hidrata mais que normal
• Proteína no jantar (1g/kg mínimo)
• Mobilidade leve de quadril e ombro
• Dormir cedo — quinta vem UPPER B forte

🥊 Bom treino!`,
  },
  {
    key: "training:thursday",
    name: "Treino — Quinta (Upper B)",
    content: `💪 <b>QUINTA · UPPER B</b>
<i>hipertrofia · braços · ombro posterior</i>
━━━━━━━━━━━━━━━━━━

<b>① Incline Dumbbell Bench</b>
    ➜ <code>4 × 8-10</code>

<b>② Lat Pulldown</b>
    ➜ <code>4 × 10-12</code>

<b>③ Meadows Row</b>  ·  <i>unilateral</i>
    ➜ <code>3 × 8-10</code>

<b>④ Pec Deck</b>
    ➜ <code>3 × 12-15</code>

<b>⑤ Rear Delt Fly + Face Pull</b>  <i>superset</i>
    ➜ <code>3 × 12-15</code>

<b>⑥ Cable Lateral Raise</b>
    ➜ <code>3 × 12-15</code>

<b>⑦ Hammer Curl</b>
    ➜ <code>3 × 10-12</code>

<b>⑧ Overhead Tricep Extension</b>
    ➜ <code>3 × 8-10</code>

💪 Bom treino!`,
  },
  {
    key: "training:friday",
    name: "Treino — Sexta (Lower B)",
    content: `🍑 <b>SEXTA · LOWER B</b>
<i>posterior · força + tensão excêntrica</i>
━━━━━━━━━━━━━━━━━━

<b>① Hip Thrust</b>
    ➜ <code>4 × 6-8</code>

<b>② Hack Squat</b>
    ➜ <code>4 × 8-10</code>

<b>③ Bulgarian Split Squat</b>
    ➜ <code>3 × 10-12 cada perna</code>

<b>④ Nordic Hamstring Curl</b>  <i>(4-5s excêntrica)</i>
    ➜ <code>3 × 6-8</code>

<b>⑤ Seated Calf Raise</b>
    ➜ <code>3 × 12-15</code>

<b>⑥ Machine Crunch</b>
    ➜ <code>3 × 10-12</code>

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

<i>Próximo treino: segunda — UPPER A.</i>`,
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

<i>Próximo treino: segunda — UPPER A.</i>`,
  },
];

export const ALL_DEFAULTS: TemplateDefault[] = [
  ...WORK_CLOCK_DEFAULTS,
  ...TRAINING_DEFAULTS,
];

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
