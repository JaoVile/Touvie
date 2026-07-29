/**
 * Lembretes pessoais (por área) — protótipo de UI.
 *
 * Por enquanto vivem só no navegador (localStorage + CustomEvent, o mesmo
 * padrão do toggle de estrelas / fita do cursor): dá pra criar, listar,
 * pausar e excluir e "sentir o fluxo" sem tocar no banco. Quando ligarmos o
 * disparo de verdade, isto migra pra uma tabela `user_reminders` + um
 * cron-mestre que varre e envia pelo Telegram.
 */

export const REMINDERS_STORAGE_KEY = "touvie:reminders";
export const REMINDERS_EVENT = "touvie:reminders";

/** Agendamento de um lembrete — fixo no dia, por dias da semana, ou intervalo. */
export type ReminderSchedule =
  | { type: "daily"; time: string } // "12:30"
  | { type: "weekly"; days: number[]; time: string } // days: 0=Dom … 6=Sáb
  | { type: "interval"; everyHours: number; from: string; to: string }
  | { type: "once"; date: string; time: string }; // date: "YYYY-MM-DD"

export type Reminder = {
  id: string;
  /** Área que criou o lembrete (ex: "dieta", "treino"). */
  area: string;
  message: string;
  schedule: ReminderSchedule;
  active: boolean;
  createdAt: number;
};

export function loadReminders(): Reminder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REMINDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Reminder[]) : [];
  } catch {
    return [];
  }
}

export function saveReminders(list: Reminder[]): void {
  localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(list));
  // Instâncias abertas (outras abas/áreas) re-sincronizam na hora.
  window.dispatchEvent(new CustomEvent(REMINDERS_EVENT));
}

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

const MONTHS_FULL = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** Frase legível do agendamento, pra exibir no card do lembrete. */
export function describeSchedule(s: ReminderSchedule): string {
  if (s.type === "once") {
    const [, m, d] = s.date.split("-").map((n) => Number.parseInt(n, 10));
    return `Uma vez em ${String(d).padStart(2, "0")} de ${MONTHS_FULL[m - 1]} às ${s.time}`;
  }
  if (s.type === "daily") return `Todo dia às ${s.time}`;
  if (s.type === "weekly") {
    if (s.days.length === 0) return `Sem dias · ${s.time}`;
    if (s.days.length === 7) return `Todo dia às ${s.time}`;
    const labels = [...s.days]
      .sort((a, b) => a - b)
      .map((d) => WEEKDAY_SHORT[d])
      .join(", ");
    return `${labels} às ${s.time}`;
  }
  return `A cada ${s.everyHours}h · ${s.from}–${s.to}`;
}
