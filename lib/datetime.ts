import { addDays, format, parseISO } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

const TZ = "America/Sao_Paulo";

export function formatDateBRT(d: Date): string {
  const zoned = toZonedTime(d, TZ);
  return format(zoned, "EEEE, dd 'de' MMMM", { locale: ptBR });
}

export function todayWeekday(): number {
  const zoned = toZonedTime(new Date(), TZ);
  return zoned.getDay();
}

export function greetingForHour(): string {
  const zoned = toZonedTime(new Date(), TZ);
  const h = zoned.getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function todayBRT(): Date {
  return toZonedTime(new Date(), TZ);
}

export function todayBRTISO(): string {
  return todayBRT().toISOString().slice(0, 10);
}

/** Meia-noite BRT de hoje como instante UTC (ISO). Base do filtro "quest de hoje". */
export function startOfTodayBRTUTC(): string {
  return fromZonedTime(`${todayBRTISO()}T00:00:00`, TZ).toISOString();
}

export function tomorrowBRTISO(): string {
  const t = todayBRT();
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

export function weekStartISO(d: Date = new Date()): string {
  const zoned = toZonedTime(d, TZ);
  const day = zoned.getDay(); // 0=sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(zoned);
  monday.setDate(zoned.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export function addWeeks(weekStart: string, n: number): string {
  const d = parseISO(weekStart);
  return addDays(d, n * 7)
    .toISOString()
    .slice(0, 10);
}

export function addDaysISO(dateISO: string, n: number): string {
  return addDays(parseISO(dateISO), n).toISOString().slice(0, 10);
}

export function weekRangeLabelBR(weekStart: string): string {
  const start = parseISO(weekStart);
  const end = addDays(start, 6);
  const same = start.getMonth() === end.getMonth();
  if (same) {
    return `${format(start, "dd", { locale: ptBR })} — ${format(end, "dd 'de' MMM", { locale: ptBR })}`;
  }
  return `${format(start, "dd 'de' MMM", { locale: ptBR })} — ${format(end, "dd 'de' MMM", { locale: ptBR })}`;
}

export function dayLabelBR(dateISO: string): string {
  const d = parseISO(dateISO);
  return format(d, "EEEE, dd 'de' MMMM", { locale: ptBR });
}
