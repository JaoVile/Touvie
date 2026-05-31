export type AccountKind = "cash" | "checking" | "savings" | "credit" | "investment";
export type CategoryKind = "income" | "expense";
export type TransactionKind = CategoryKind;

export const ACCOUNT_KINDS: AccountKind[] = ["cash", "checking", "savings", "credit", "investment"];

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  cash: "Dinheiro",
  checking: "Conta corrente",
  savings: "Poupança",
  credit: "Cartão de crédito",
  investment: "Investimentos",
};

export const ACCOUNT_KIND_EMOJIS: Record<AccountKind, string> = {
  cash: "💵",
  checking: "🏦",
  savings: "🐷",
  credit: "💳",
  investment: "📈",
};

export function reaisToCents(value: number): number {
  return Math.round(value * 100);
}

export function centsToReais(cents: number): number {
  return cents / 100;
}

export interface RecurrenceRule {
  kind: "monthly";
  day: number;
}

export function parseRecurrenceRule(rule: string | null | undefined): RecurrenceRule | null {
  if (!rule) return null;
  const m = rule.match(/^monthly:(\d{1,2})$/);
  if (!m) return null;
  const day = Number.parseInt(m[1], 10);
  if (day < 1 || day > 31) return null;
  return { kind: "monthly", day };
}

export function recurrenceLabel(rule: string | null | undefined): string {
  const r = parseRecurrenceRule(rule);
  if (!r) return "—";
  return `Todo dia ${r.day}`;
}

// --- CRÉDITO / PARCELAMENTO ------------------------------------------

/** Soma `months` meses a uma data ISO (YYYY-MM-DD), preservando fim de mês. */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(d, lastDay));
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

/**
 * Ciclo de fatura que contém `ref`, dado o dia de fechamento.
 * A fatura fecha no dia `closingDay`; compras até o fechamento entram nesse ciclo,
 * depois disso vão pro próximo. Retorna datas ISO inclusivas {start, end}.
 */
export function billingCycle(closingDay: number, ref: Date): { start: string; end: string } {
  const day = Math.min(Math.max(closingDay, 1), 28);
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const refDay = ref.getDate();
  // Fechamento do ciclo que contém ref
  const closeMonthOffset = refDay <= day ? 0 : 1;
  const close = new Date(y, m + closeMonthOffset, day);
  const start = new Date(close.getFullYear(), close.getMonth() - 1, day + 1);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: iso(start), end: iso(close) };
}

/** Divide um total em `n` parcelas inteiras (em centavos), distribuindo o resto nas primeiras. */
export function splitInstallments(totalCents: number, n: number): number[] {
  if (n <= 1) return [totalCents];
  const base = Math.floor(totalCents / n);
  let remainder = totalCents - base * n;
  return Array.from({ length: n }, () => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder--;
    return base + extra;
  });
}

/** Limite disponível: limite + saldo atual (saldo é negativo quando há dívida). */
export function availableCredit(limitCents: number | null, currentCents: number): number | null {
  if (limitCents == null) return null;
  return limitCents + currentCents;
}

export const SEED_CATEGORIES: Array<{
  name: string;
  kind: CategoryKind;
  emoji: string;
  color: string;
}> = [
  { name: "Moradia", kind: "expense", emoji: "🏠", color: "#a855f7" },
  { name: "Mercado", kind: "expense", emoji: "🛒", color: "#ec4899" },
  { name: "Transporte", kind: "expense", emoji: "🚗", color: "#3b82f6" },
  { name: "Alimentação", kind: "expense", emoji: "🍽️", color: "#f59e0b" },
  { name: "Saúde", kind: "expense", emoji: "🏥", color: "#ef4444" },
  { name: "Lazer", kind: "expense", emoji: "🎮", color: "#10b981" },
  { name: "Educação", kind: "expense", emoji: "📚", color: "#8b5cf6" },
  { name: "Assinaturas", kind: "expense", emoji: "📺", color: "#06b6d4" },
  { name: "Outros gastos", kind: "expense", emoji: "💸", color: "#64748b" },
  { name: "Salário", kind: "income", emoji: "💼", color: "#22c55e" },
  { name: "Freelance", kind: "income", emoji: "💻", color: "#14b8a6" },
  { name: "Investimentos", kind: "income", emoji: "📈", color: "#84cc16" },
  { name: "Outras receitas", kind: "income", emoji: "🎁", color: "#10b981" },
];
