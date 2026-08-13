import { reaisToCents } from "@/lib/finance";
import type { ToubeCtx } from "@/lib/toube-ctx";
import { z } from "zod";

export const txSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid().nullable(),
  amount: z.number().positive("Valor deve ser maior que zero"),
  kind: z.enum(["income", "expense"]),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  description: z.string().max(200).nullable(),
});

/**
 * Modelo "um total só": o usuário não escolhe banco. Toda transação precisa de
 * uma conta pra entrar no saldo, então usamos UMA conta implícita por usuário
 * (a primeira não-cartão, ou uma "Carteira" criada na hora).
 */
export async function defaultAccountId(ctx: ToubeCtx): Promise<string> {
  const { data: accs } = await ctx.supabase
    .from("finance_accounts")
    .select("id, kind")
    .eq("user_id", ctx.userId)
    .eq("archived", false)
    .order("created_at", { ascending: true });
  const list = accs ?? [];
  const preferred = list.find((a) => a.kind !== "credit") ?? list[0];
  if (preferred) return preferred.id as string;

  const { data: created } = await ctx.supabase
    .from("finance_accounts")
    .insert({ user_id: ctx.userId, name: "Carteira", kind: "cash", balance_cents: 0 })
    .select("id")
    .single();
  if (!created) throw new Error("Não consegui criar a conta padrão.");
  return created.id as string;
}

export async function saveTransactionCore(
  ctx: ToubeCtx,
  input: unknown,
): Promise<{ ok?: boolean; error?: string }> {
  const parsed = txSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  if (parsed.data.id) {
    // Edição: não mexe na conta (invisível pro usuário), só nos campos visíveis.
    const { error } = await ctx.supabase
      .from("transactions")
      .update({
        category_id: parsed.data.category_id,
        amount_cents: reaisToCents(parsed.data.amount),
        kind: parsed.data.kind,
        occurred_on: parsed.data.occurred_on,
        description: parsed.data.description,
      })
      .eq("id", parsed.data.id)
      .eq("user_id", ctx.userId);
    if (error) return { error: error.message };
    return { ok: true };
  }

  const accountId = await defaultAccountId(ctx);
  const { error } = await ctx.supabase.from("transactions").insert({
    user_id: ctx.userId,
    account_id: accountId,
    category_id: parsed.data.category_id,
    amount_cents: reaisToCents(parsed.data.amount),
    kind: parsed.data.kind,
    occurred_on: parsed.data.occurred_on,
    description: parsed.data.description,
    is_recurring: false,
    recurrence_rule: null,
    reminder_enabled: false,
  });
  if (error) return { error: error.message };
  return { ok: true };
}
