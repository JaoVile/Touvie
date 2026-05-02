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
