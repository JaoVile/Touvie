"use server";

import { todayBRTISO } from "@/lib/datetime";
import { SEED_CATEGORIES, reaisToCents } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, userId: user.id };
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Modelo "um total só": o usuário não escolhe banco. Toda transação precisa de
 * uma conta pra entrar no saldo, então usamos UMA conta implícita por usuário
 * (a primeira não-cartão, ou uma "Carteira" criada na hora). O total exibido é
 * a soma de tudo, então qual conta recebe o lançamento é irrelevante pra ele.
 */
async function defaultAccountId(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: accs } = await supabase
    .from("finance_accounts")
    .select("id, kind")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("created_at", { ascending: true });
  const list = accs ?? [];
  const preferred = list.find((a) => a.kind !== "credit") ?? list[0];
  if (preferred) return preferred.id as string;

  const { data: created } = await supabase
    .from("finance_accounts")
    .insert({ user_id: userId, name: "Carteira", kind: "cash", balance_cents: 0 })
    .select("id")
    .single();
  if (!created) throw new Error("Não foi possível criar a carteira");
  return created.id as string;
}

// --- SEED ----------------------------------------------------------

export async function seedDefaultCategories(): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, userId } = await requireUser();
  const { data: existing } = await supabase
    .from("finance_categories")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  if (existing && existing.length > 0) return { error: "Você já tem categorias cadastradas" };

  const rows = SEED_CATEGORIES.map((c) => ({
    user_id: userId,
    name: c.name,
    kind: c.kind,
    emoji: c.emoji,
    color: c.color,
  }));
  const { error } = await supabase.from("finance_categories").insert(rows);
  if (error) return { error: error.message };
  revalidatePath("/financas");
  return { ok: true };
}

// --- CATEGORIES ----------------------------------------------------

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(60),
  kind: z.enum(["income", "expense"]),
  emoji: z.string().max(8).nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")
    .nullable(),
});

export async function saveCategory(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const parsed = categorySchema.safeParse({
    id: fd.get("id")?.toString() || undefined,
    name: fd.get("name")?.toString(),
    kind: fd.get("kind")?.toString(),
    emoji: fd.get("emoji")?.toString() || null,
    color: fd.get("color")?.toString() || null,
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  const { supabase, userId } = await requireUser();
  const payload = {
    user_id: userId,
    name: parsed.data.name,
    kind: parsed.data.kind,
    emoji: parsed.data.emoji,
    color: parsed.data.color,
  };
  const { error } = parsed.data.id
    ? await supabase.from("finance_categories").update(payload).eq("id", parsed.data.id)
    : await supabase.from("finance_categories").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/financas");
  return { ok: true };
}

export async function archiveCategory(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("finance_categories").update({ archived: true }).eq("id", id);
  revalidatePath("/financas");
}

// --- TRANSACTIONS --------------------------------------------------

const txSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid().nullable(),
  amount: z.number().positive("Valor deve ser maior que zero"),
  kind: z.enum(["income", "expense"]),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  description: z.string().max(200).nullable(),
});

export async function saveTransaction(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const amountStr = (fd.get("amount")?.toString() ?? "").replace(",", ".");
  const amount = Number.parseFloat(amountStr);

  const parsed = txSchema.safeParse({
    id: fd.get("id")?.toString() || undefined,
    category_id: fd.get("category_id")?.toString() || null,
    amount: Number.isFinite(amount) ? amount : 0,
    kind: fd.get("kind")?.toString(),
    occurred_on: fd.get("occurred_on")?.toString(),
    description: fd.get("description")?.toString() || null,
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  const { supabase, userId } = await requireUser();

  if (parsed.data.id) {
    // Edição: não mexe na conta (invisível pro usuário), só nos campos visíveis.
    const { error } = await supabase
      .from("transactions")
      .update({
        category_id: parsed.data.category_id,
        amount_cents: reaisToCents(parsed.data.amount),
        kind: parsed.data.kind,
        occurred_on: parsed.data.occurred_on,
        description: parsed.data.description,
      })
      .eq("id", parsed.data.id);
    if (error) return { error: error.message };
  } else {
    const accountId = await defaultAccountId(supabase, userId);
    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
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
  }

  revalidatePath("/financas");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteTransaction(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("transactions").delete().eq("id", id);
  revalidatePath("/financas");
  revalidatePath("/");
}

/**
 * Apaga VÁRIOS lançamentos de uma vez (seleção em lote na aba Lançamentos —
 * limpar lixo de import). Valida os ids, limita o lote e escopa por user_id
 * (além do RLS). Deletar mexe no saldo (a view soma as transações).
 */
export async function deleteTransactions(
  ids: string[],
): Promise<{ ok?: boolean; error?: string; deleted?: number }> {
  const valid = [...new Set(ids)].filter((id) => z.string().uuid().safeParse(id).success);
  if (!valid.length) return { error: "Nada selecionado." };
  if (valid.length > 200) return { error: "Muitos de uma vez (máx 200)." };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("transactions")
    .delete()
    .in("id", valid)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/financas");
  revalidatePath("/");
  return { ok: true, deleted: valid.length };
}

/**
 * Ajusta o saldo TOTAL pela realidade: o usuário digita quanto tem de fato e
 * geramos um lançamento de ajuste (receita ou despesa) do tamanho da diferença
 * entre o real e o total calculado. Sem categoria; entra no total como qualquer
 * lançamento.
 */
export async function adjustTotalBalance(
  realReais: number,
): Promise<{ ok?: boolean; error?: string }> {
  if (!Number.isFinite(realReais)) return { error: "Valor inválido" };

  const { supabase, userId } = await requireUser();
  const { data: bals } = await supabase
    .from("finance_account_balances")
    .select("current_cents")
    .eq("user_id", userId);
  const totalCents = (bals ?? []).reduce((s, b) => s + (b.current_cents as number), 0);

  const deltaCents = reaisToCents(realReais) - totalCents;
  if (deltaCents === 0) return { ok: true };

  const accountId = await defaultAccountId(supabase, userId);
  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    account_id: accountId,
    category_id: null,
    amount_cents: Math.abs(deltaCents),
    kind: deltaCents > 0 ? "income" : "expense",
    occurred_on: todayBRTISO(),
    description: "Ajuste de saldo",
    is_recurring: false,
    recurrence_rule: null,
    reminder_enabled: false,
  });
  if (error) return { error: error.message };
  revalidatePath("/financas");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Zera as MOVIMENTAÇÕES financeiras do usuário — apaga lançamentos, contas a
 * pagar e caixinhas. Mantém o SETUP (categorias e contas/carteira). Com isso o
 * saldo (derivado dos lançamentos) e o "a pagar" voltam a zero, e o gráfico
 * esvazia. Útil pra limpar dados de teste e começar do zero.
 */
export async function resetFinances(): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, userId } = await requireUser();

  // Lançamentos primeiro (alguns referenciam bill_id), depois contas e caixinhas.
  const tx = await supabase.from("transactions").delete().eq("user_id", userId);
  if (tx.error) return { error: tx.error.message };
  const bills = await supabase.from("bills").delete().eq("user_id", userId);
  if (bills.error) return { error: bills.error.message };
  const env = await supabase.from("budget_envelopes").delete().eq("user_id", userId);
  if (env.error) return { error: env.error.message };

  revalidatePath("/financas");
  revalidatePath("/");
  return { ok: true };
}

// --- BILLS ---------------------------------------------------------

const billSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, "Título obrigatório").max(120),
  amount: z.number().positive("Valor deve ser maior que zero"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  recurrence_rule: z.string().nullable(),
  category_id: z.string().uuid().nullable(),
  notes: z.string().max(300).nullable(),
});

export async function saveBill(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const amountStr = (fd.get("amount")?.toString() ?? "").replace(",", ".");
  const amount = Number.parseFloat(amountStr);
  const parsed = billSchema.safeParse({
    id: fd.get("id")?.toString() || undefined,
    title: fd.get("title")?.toString(),
    amount: Number.isFinite(amount) ? amount : 0,
    due_date: fd.get("due_date")?.toString(),
    recurrence_rule: fd.get("recurrence_rule")?.toString() || null,
    category_id: fd.get("category_id")?.toString() || null,
    notes: fd.get("notes")?.toString() || null,
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  const { supabase, userId } = await requireUser();
  const payload = {
    user_id: userId,
    title: parsed.data.title,
    amount_cents: reaisToCents(parsed.data.amount),
    due_date: parsed.data.due_date,
    recurrence_rule: parsed.data.recurrence_rule,
    category_id: parsed.data.category_id,
    notes: parsed.data.notes,
  };
  const { error } = parsed.data.id
    ? await supabase.from("bills").update(payload).eq("id", parsed.data.id)
    : await supabase.from("bills").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/financas");
  return { ok: true };
}

/**
 * Marca/desmarca uma conta como paga. Ao pagar, cria a despesa real (linkada via
 * `bill_id`) que abate o saldo total — sem perguntar de onde sai, pois o total é
 * único. Ao desmarcar, remove a despesa linkada. Idempotente.
 */
export async function toggleBillPaid(id: string, paid: boolean): Promise<void> {
  const { supabase, userId } = await requireUser();

  if (!paid) {
    await supabase.from("transactions").delete().eq("user_id", userId).eq("bill_id", id);
    await supabase.from("bills").update({ paid_at: null }).eq("id", id);
    revalidatePath("/financas");
    revalidatePath("/");
    return;
  }

  await supabase.from("bills").update({ paid_at: new Date().toISOString() }).eq("id", id);

  const { data: bill } = await supabase
    .from("bills")
    .select("title, amount_cents, category_id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (bill) {
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("bill_id", id)
      .limit(1);
    if (!existing || existing.length === 0) {
      const accountId = await defaultAccountId(supabase, userId);
      await supabase.from("transactions").insert({
        user_id: userId,
        account_id: accountId,
        category_id: bill.category_id,
        amount_cents: bill.amount_cents,
        kind: "expense",
        occurred_on: todayBRTISO(),
        description: bill.title,
        is_recurring: false,
        recurrence_rule: null,
        reminder_enabled: false,
        bill_id: id,
      });
    }
  }

  revalidatePath("/financas");
  revalidatePath("/");
}

export async function deleteBill(id: string): Promise<void> {
  const { supabase } = await requireUser();
  await supabase.from("bills").delete().eq("id", id);
  revalidatePath("/financas");
}

// --- BUDGET ENVELOPES (Caixinhas) ----------------------------------

const envelopeSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid().nullable(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido"),
  limit: z.number().positive("Limite deve ser maior que zero"),
  name: z.string().min(1, "Nome obrigatório").max(60),
  emoji: z.string().max(8).nullable(),
  color: z.string().nullable(),
});

export async function saveEnvelope(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const limitStr = (fd.get("limit")?.toString() ?? "").replace(",", ".");
  const limit = Number.parseFloat(limitStr);
  const parsed = envelopeSchema.safeParse({
    id: fd.get("id")?.toString() || undefined,
    category_id: fd.get("category_id")?.toString() || null,
    month: fd.get("month")?.toString(),
    limit: Number.isFinite(limit) ? limit : 0,
    name: fd.get("name")?.toString(),
    emoji: fd.get("emoji")?.toString() || null,
    color: fd.get("color")?.toString() || null,
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  const { supabase, userId } = await requireUser();
  const payload = {
    user_id: userId,
    category_id: parsed.data.category_id,
    month: parsed.data.month,
    limit_cents: reaisToCents(parsed.data.limit),
    name: parsed.data.name,
    emoji: parsed.data.emoji,
    color: parsed.data.color,
  };
  const { error } = parsed.data.id
    ? await supabase.from("budget_envelopes").update(payload).eq("id", parsed.data.id)
    : await supabase.from("budget_envelopes").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/financas");
  return { ok: true };
}

export async function deleteEnvelope(id: string): Promise<void> {
  const { supabase } = await requireUser();
  await supabase.from("budget_envelopes").delete().eq("id", id);
  revalidatePath("/financas");
}
