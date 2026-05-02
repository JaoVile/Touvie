import { todayBRT } from "@/lib/datetime";
import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/telegram";
import { NextResponse } from "next/server";

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${expected}`) return true;
  if (req.headers.get("x-cron-secret") === expected) return true;
  return false;
}

const WORKOUTS: Record<number, string> = {
  // ──────────────────────────────────────────────
  // SEGUNDA — UPPER A · força horizontal/vertical
  // ──────────────────────────────────────────────
  1: `🏋️‍♂️ <b>SEGUNDA · UPPER A</b>
<i>peito · costas · ombros · braços (modo força)</i>
━━━━━━━━━━━━━━━━━━

<b>① Flat Barbell Bench</b>  ·  <i>peito horizontal</i>
    supino reto c/ barra
    ➜ <code>4 × 6-8</code>  ·  RIR 1-2

<b>② Pull-up</b>  ·  <i>costas vertical (largura)</i>
    barra fixa  ·  alt: lat pulldown
    ➜ <code>4 × 8-10</code>

<b>③ Overhead Press</b>  ·  <i>ombro frontal + builder</i>
    desenvolvimento militar (barra)  ·  alt: halteres
    ➜ <code>3 × 6-8</code>

<b>④ Seal Row</b>  ·  <i>costas horizontal (espessura)</i>
    remada Seal (banco peito-apoiado)  ·  alt: barbell row
    ➜ <code>3 × 8-10</code>

<b>⑤ Lateral Raise</b>  ·  <i>ombro lateral (look 3D)</i>
    elevação lateral c/ halteres ou cabo
    ➜ <code>3 × 12-15</code>

<b>⑥ Barbell Curl</b>  ·  <i>bíceps principal (pesado)</i>
    rosca direta — "o supino do bíceps"
    ➜ <code>3 × 8-10</code>  ·  alt: EZ se doer punho

<b>⑦ Cable Pushdown</b>  ·  <i>tríceps cabeça lateral</i>
    tríceps no pulley (qualquer pegada)
    ➜ <code>3 × 10-12</code>

━━━━━━━━━━━━━━━━━━
⚙️ <b>REGRAS DO DIA</b>
• Composto pesado <b>SEMPRE 1º</b> — supino e pull antes de qualquer isolamento
• Curl tratado <b>como supino</b>: 1º exercício de braço, com carga
• <b>Sem front raise</b> — ombro frontal já é demolido pelos pressões
• Progressão de carga &gt; volume infinito

💪 Bom treino!`,

  // ──────────────────────────────────────────────
  // TERÇA — LOWER A · quad focus
  // ──────────────────────────────────────────────
  2: `🦵 <b>TERÇA · LOWER A</b>
<i>quadríceps · panturrilha · core (modo força)</i>
━━━━━━━━━━━━━━━━━━

<b>① Squat</b>  ·  <i>quad compound (sem pressa, sem ego)</i>
    agachamento livre c/ barra  ·  alt: hex bar squat
    ➜ <code>4 × 6-8</code>  ·  RIR 1-2

<b>② Romanian Deadlift</b>  ·  <i>posterior hip-hinge</i>
    stiff romeno c/ barra
    ➜ <code>3 × 8-10</code>

<b>③ Leg Extension</b>  ·  <i>quad isolation</i>
    cadeira extensora  ·  alt: bulgarian split squat
    ➜ <code>3 × 12-15</code>

<b>④ Hamstring Curl</b>  ·  <i>posterior isolation</i>
    cadeira/mesa flexora  ·  alt: nordic curl
    ➜ <code>3 × 12-15</code>

<b>⑤ Standing Calf Raise</b>  ·  <i>panturrilha (gastrocnêmio)</i>
    em pé no smith ou máquina
    ➜ <code>4 × 12-15</code>

<b>⑥ Cable Crunch</b>  ·  <i>abs com carga</i>
    abdominal na polia
    ➜ <code>3 × 10-12</code>

━━━━━━━━━━━━━━━━━━
⚙️ <b>REGRAS DO DIA</b>
• Squat pesado <b>1º</b> — entra concentrado, sai grande
• Ab tratado <b>como bench</b>: adiciona carga toda semana
• Esquece rotina de chão de 5min — uma série pesada vence todas
• Calf raise: pausa 1s embaixo, pico contraído em cima

💪 Bom treino!`,

  // ──────────────────────────────────────────────
  // QUARTA — BOX · cardio + recovery
  // ──────────────────────────────────────────────
  3: `🥊 <b>QUARTA · BOX</b>
━━━━━━━━━━━━━━━━━━

Hoje o BOX cobre cardio, ombro frontal e core.
Foca <b>técnica</b> — não é dia de "puxar carga".

⚙️ <b>RECOVERY DO DIA</b>
• Hidrata mais que normal — perdeu muito suor
• Proteína no jantar (1g/kg mínimo)
• Mobilidade leve de quadril e ombro
• Dormir cedo — quinta vem UPPER B forte

🥊 Bom treino!`,

  // ──────────────────────────────────────────────
  // QUINTA — UPPER B · hipertrofia + braços
  // ──────────────────────────────────────────────
  4: `💪 <b>QUINTA · UPPER B</b>
<i>hipertrofia · braços · ombro posterior</i>
━━━━━━━━━━━━━━━━━━

<b>① Incline Dumbbell Bench</b>  ·  <i>peito incline</i>
    supino inclinado c/ halteres
    ➜ <code>4 × 8-10</code>

<b>② Lat Pulldown</b>  ·  <i>costas vertical (pegada nova)</i>
    puxada frente — alterna pegada vs. segunda
    ➜ <code>4 × 10-12</code>

<b>③ Meadows Row</b>  ·  <i>costas horizontal (unilateral)</i>
    remada Meadows (barra única lateral)  ·  alt: seal row
    ➜ <code>3 × 8-10</code>

<b>④ Pec Deck</b>  ·  <i>peito isolation</i>
    voador / butterfly  ·  alt: cable fly
    ➜ <code>3 × 12-15</code>

<b>⑤ Rear Delt Fly + Face Pull</b>  ·  <i>ombro posterior</i>
    crucifixo invertido + face pull c/ corda
    ➜ <code>3 × 12-15</code>  superset

<b>⑥ Cable Lateral Raise</b>  ·  <i>ombro lateral (3D)</i>
    elevação lateral no cabo (resistência constante)
    ➜ <code>3 × 12-15</code>

<b>⑦ Hammer Curl</b>  ·  <i>braquial + braquiorradial</i>
    rosca martelo — engrossa o braço inteiro
    ➜ <code>3 × 10-12</code>

<b>⑧ Overhead Tricep Extension</b>  ·  <i>cabeça longa</i>
    tríceps francês  ·  alt: skull crusher
    ➜ <code>3 × 8-10</code>

━━━━━━━━━━━━━━━━━━
⚙️ <b>REGRAS DO DIA</b>
• Posterior de ombro NÃO negligencia — ou vira postura de gorila
• Cabeça longa do tríceps = arma secreta (50% do braço de costas)
• Hammer curl não é "extra" — braquial faz o braço parecer maior
• <b>Sem front raise</b> (de novo)

💪 Bom treino!`,

  // ──────────────────────────────────────────────
  // SEXTA — LOWER B · posterior + excêntrica
  // ──────────────────────────────────────────────
  5: `🍑 <b>SEXTA · LOWER B</b>
<i>posterior · força + tensão excêntrica</i>
━━━━━━━━━━━━━━━━━━

<b>① Hip Thrust</b>  ·  <i>posterior compound</i>
    elevação pélvica c/ barra  ·  alt: deadlift convencional
    ➜ <code>4 × 6-8</code>

<b>② Hack Squat</b>  ·  <i>quad compound (ângulo novo)</i>
    agachamento hack  ·  alt: leg press 45°
    ➜ <code>4 × 8-10</code>

<b>③ Bulgarian Split Squat</b>  ·  <i>quad unilateral + glúteo</i>
    afundo búlgaro (pé traseiro no banco)
    ➜ <code>3 × 10-12 cada perna</code>

<b>④ Nordic Hamstring Curl</b>  ·  <i>posterior excêntrico</i>
    joelho ancorado, desce DEVAGAR (4-5s)
    ➜ <code>3 × 6-8</code>

<b>⑤ Seated Calf Raise</b>  ·  <i>panturrilha (sóleo)</i>
    sentado, máquina dedicada
    ➜ <code>3 × 12-15</code>

<b>⑥ Machine Crunch</b>  ·  <i>abs com carga</i>
    abdominal na máquina
    ➜ <code>3 × 10-12</code>

━━━━━━━━━━━━━━━━━━
⚙️ <b>REGRAS DO DIA</b>
• Hip thrust pesado <b>1º</b>, sem rebote no chão
• Nordic curl: <b>4-5s na descida</b>, controla a excêntrica
• Ab com carga, sem rotina de chão
• Sexta = recompensa, mas só DEPOIS das séries pesadas

💪 Bom treino — fim de semana liberado!`,

  // ──────────────────────────────────────────────
  // SÁBADO — descanso ativo
  // ──────────────────────────────────────────────
  6: `🛋️ <b>SÁBADO · DESCANSO</b>
━━━━━━━━━━━━━━━━━━

Recuperação ativa, não preguiça.

⚙️ <b>HOJE</b>
• 8h de sono &gt; qualquer suplemento
• Caminhada leve 20-30min (opcional)
• Refeições com proteína espalhadas no dia
• Mobilidade de quadril e ombro

<i>Próximo treino: segunda — UPPER A.</i>`,

  // ──────────────────────────────────────────────
  // DOMINGO — descanso + planning
  // ──────────────────────────────────────────────
  0: `🛋️ <b>DOMINGO · DESCANSO</b>
━━━━━━━━━━━━━━━━━━

Última recuperação antes da semana.

⚙️ <b>PLANEJA AGORA</b>
• Pesa hoje (em jejum, depois do banheiro)
• Confere progressão da semana — onde subiu carga?
• Prepara as marmitas
• Dorme cedo

<i>Próximo treino: segunda — UPPER A.</i>`,
};

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const weekday = todayBRT().getUTCDay();
  const text = WORKOUTS[weekday];
  if (!text) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_workout_for_weekday" });
  }

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, telegram_chat_id")
    .not("telegram_chat_id", "is", null);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_subscribers" });
  }

  let sent = 0;
  for (const p of profiles) {
    if (!p.telegram_chat_id) continue;
    try {
      await sendMessage(p.telegram_chat_id, text);
      sent += 1;
    } catch (err) {
      console.error(`Telegram send failed for ${p.id}:`, err);
    }
  }

  logEvent({
    userId: profiles[0]?.id ?? null,
    eventType: "cron",
    source: "cron/training-reminder",
    status: sent > 0 ? "success" : "warning",
    messagePreview: text,
    metadata: { sent, weekday, profiles: profiles.length },
  });

  return NextResponse.json({ ok: true, sent, weekday });
}
