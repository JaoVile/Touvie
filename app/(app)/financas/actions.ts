"use server";

import {
  ACCOUNT_KINDS,
  SEED_CATEGORIES,
  addMonthsISO,
  reaisToCents,
  splitInstallments,
} from "@/lib/finance";
import { detectAndParse, guessCategory } from "@/lib/importers/csv";
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

// --- ACCOUNTS ------------------------------------------------------

const accountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Nome obrigatório").max(60),
  kind: z.enum(ACCOUNT_KINDS as [string, ...string[]]),
  balance: z.number().finite(),
  credit_limit: z.number().nonnegative().nullable(),
  closing_day: z.number().int().min(1).max(28).nullable(),
  due_day: z.number().int().min(1).max(31).nullable(),
});

function parseIntOrNull(v: string | undefined): number | null {
  if (!v || !/^\d+$/.test(v)) return null;
  return Number.parseInt(v, 10);
}

export async function saveAccount(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const balanceStr = (fd.get("balance")?.toString() ?? "0").replace(",", ".");
  const balance = Number.parseFloat(balanceStr);
  const isCredit = fd.get("kind")?.toString() === "credit";
  const limitStr = (fd.get("credit_limit")?.toString() ?? "").replace(",", ".");
  const limit = Number.parseFloat(limitStr);
  const parsed = accountSchema.safeParse({
    id: fd.get("id")?.toString() || undefined,
    name: fd.get("name")?.toString(),
    kind: fd.get("kind")?.toString(),
    balance: Number.isFinite(balance) ? balance : 0,
    credit_limit: isCredit && Number.isFinite(limit) ? limit : null,
    closing_day: isCredit ? parseIntOrNull(fd.get("closing_day")?.toString()) : null,
    due_day: isCredit ? parseIntOrNull(fd.get("due_day")?.toString()) : null,
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  const { supabase, userId } = await requireUser();
  const payload = {
    user_id: userId,
    name: parsed.data.name,
    kind: parsed.data.kind,
    balance_cents: reaisToCents(parsed.data.balance),
    credit_limit_cents:
      parsed.data.credit_limit != null ? reaisToCents(parsed.data.credit_limit) : null,
    closing_day: parsed.data.closing_day,
    due_day: parsed.data.due_day,
  };
  const { error } = parsed.data.id
    ? await supabase.from("finance_accounts").update(payload).eq("id", parsed.data.id)
    : await supabase.from("finance_accounts").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/financas");
  return { ok: true };
}

export async function archiveAccount(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("finance_accounts").update({ archived: true }).eq("id", id);
  revalidatePath("/financas");
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
  account_id: z.string().uuid().nullable(),
  category_id: z.string().uuid().nullable(),
  amount: z.number().positive("Valor deve ser maior que zero"),
  kind: z.enum(["income", "expense"]),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  description: z.string().max(200).nullable(),
  is_recurring: z.boolean(),
  recurrence_day: z.number().int().min(1).max(31).nullable(),
  reminder_enabled: z.boolean(),
});

export async function saveTransaction(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const isRecurring = fd.get("is_recurring") === "on" || fd.get("is_recurring") === "true";
  const recDayStr = fd.get("recurrence_day")?.toString() ?? "";
  const recDay = /^\d+$/.test(recDayStr) ? Number.parseInt(recDayStr, 10) : null;
  const amountStr = (fd.get("amount")?.toString() ?? "").replace(",", ".");
  const amount = Number.parseFloat(amountStr);
  const instStr = fd.get("installments")?.toString() ?? "";
  const installments = /^\d+$/.test(instStr)
    ? Math.min(Math.max(Number.parseInt(instStr, 10), 1), 48)
    : 1;

  const parsed = txSchema.safeParse({
    id: fd.get("id")?.toString() || undefined,
    account_id: fd.get("account_id")?.toString() || null,
    category_id: fd.get("category_id")?.toString() || null,
    amount: Number.isFinite(amount) ? amount : 0,
    kind: fd.get("kind")?.toString(),
    occurred_on: fd.get("occurred_on")?.toString(),
    description: fd.get("description")?.toString() || null,
    is_recurring: isRecurring,
    recurrence_day: isRecurring ? recDay : null,
    reminder_enabled: fd.get("reminder_enabled") === "on",
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  if (parsed.data.is_recurring && !parsed.data.recurrence_day) {
    return { error: "Informe o dia do mês da recorrência" };
  }

  const { supabase, userId } = await requireUser();

  // Compra parcelada (apenas na criação, despesa não-recorrente): N lançamentos mensais.
  if (
    !parsed.data.id &&
    !parsed.data.is_recurring &&
    parsed.data.kind === "expense" &&
    installments > 1
  ) {
    const groupId = crypto.randomUUID();
    const parts = splitInstallments(reaisToCents(parsed.data.amount), installments);
    const baseDesc = parsed.data.description ?? "";
    const rows = parts.map((cents, i) => ({
      user_id: userId,
      account_id: parsed.data.account_id,
      category_id: parsed.data.category_id,
      amount_cents: cents,
      kind: parsed.data.kind,
      occurred_on: addMonthsISO(parsed.data.occurred_on, i),
      description: `${baseDesc ? `${baseDesc} ` : ""}(${i + 1}/${installments})`.trim(),
      is_recurring: false,
      recurrence_rule: null,
      reminder_enabled: false,
      installment_group_id: groupId,
      installment_number: i + 1,
      installment_total: installments,
    }));
    const { error } = await supabase.from("transactions").insert(rows);
    if (error) return { error: error.message };
    revalidatePath("/financas");
    revalidatePath("/");
    return { ok: true };
  }

  const payload = {
    user_id: userId,
    account_id: parsed.data.account_id,
    category_id: parsed.data.category_id,
    amount_cents: reaisToCents(parsed.data.amount),
    kind: parsed.data.kind,
    occurred_on: parsed.data.occurred_on,
    description: parsed.data.description,
    is_recurring: parsed.data.is_recurring,
    recurrence_rule: parsed.data.is_recurring ? `monthly:${parsed.data.recurrence_day}` : null,
    reminder_enabled: parsed.data.reminder_enabled,
  };
  const { error } = parsed.data.id
    ? await supabase.from("transactions").update(payload).eq("id", parsed.data.id)
    : await supabase.from("transactions").insert(payload);
  if (error) return { error: error.message };
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

// --- TRANSFERS -----------------------------------------------------

const transferSchema = z
  .object({
    id: z.string().uuid().optional(),
    from_account_id: z.string().uuid("Escolha a conta de origem"),
    to_account_id: z.string().uuid("Escolha a conta de destino"),
    amount: z.number().positive("Valor deve ser maior que zero"),
    occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    description: z.string().max(200).nullable(),
  })
  .refine((d) => d.from_account_id !== d.to_account_id, {
    message: "Origem e destino devem ser contas diferentes",
    path: ["to_account_id"],
  });

export async function saveTransfer(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const amountStr = (fd.get("amount")?.toString() ?? "").replace(",", ".");
  const amount = Number.parseFloat(amountStr);
  const parsed = transferSchema.safeParse({
    id: fd.get("id")?.toString() || undefined,
    from_account_id: fd.get("from_account_id")?.toString(),
    to_account_id: fd.get("to_account_id")?.toString(),
    amount: Number.isFinite(amount) ? amount : 0,
    occurred_on: fd.get("occurred_on")?.toString(),
    description: fd.get("description")?.toString() || null,
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  const { supabase, userId } = await requireUser();
  const payload = {
    user_id: userId,
    from_account_id: parsed.data.from_account_id,
    to_account_id: parsed.data.to_account_id,
    amount_cents: reaisToCents(parsed.data.amount),
    occurred_on: parsed.data.occurred_on,
    description: parsed.data.description,
  };
  const { error } = parsed.data.id
    ? await supabase.from("transfers").update(payload).eq("id", parsed.data.id)
    : await supabase.from("transfers").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/financas");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteTransfer(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("transfers").delete().eq("id", id);
  revalidatePath("/financas");
  revalidatePath("/");
}

// --- CSV IMPORT ---------------------------------------------------

export async function importCsv(
  fd: FormData,
): Promise<{ imported: number; skipped: number; source?: string; error?: string }> {
  const { supabase, userId } = await requireUser();

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { imported: 0, skipped: 0, error: "Nenhum arquivo enviado." };
  if (file.size > 5 * 1024 * 1024)
    return { imported: 0, skipped: 0, error: "Arquivo muito grande (máx 5 MB)." };

  const text = await file.text();
  const { source, rows } = detectAndParse(text);

  if (source === "unknown" || rows.length === 0) {
    return {
      imported: 0,
      skipped: 0,
      error: "Formato não reconhecido. Verifique se é o CSV correto do Nubank ou Mercado Pago.",
    };
  }

  const SOURCE_LABEL = { nubank: "Nubank", mercadopago: "Mercado Pago" } as const;
  const accountName = source === "nubank" ? "Nubank Cartão" : "Mercado Pago";
  const accountKind = source === "nubank" ? "credit" : "checking";

  // Parallel: load categories + look up existing account
  const [catsRes, existingAccRes] = await Promise.all([
    supabase
      .from("finance_categories")
      .select("id, name, kind")
      .eq("user_id", userId)
      .eq("archived", false),
    supabase
      .from("finance_accounts")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", accountName)
      .maybeSingle(),
  ]);
  const categories = catsRes.data ?? [];

  let accountId: string | null = existingAccRes.data?.id ?? null;
  if (!accountId) {
    const { data: newAcc } = await supabase
      .from("finance_accounts")
      .insert({ user_id: userId, name: accountName, kind: accountKind, balance_cents: 0 })
      .select("id")
      .single();
    accountId = newAcc?.id ?? null;
  }

  // Check which external_refs already exist
  const refs = rows.map((r) => r.external_ref);
  const { data: existingRefs } = await supabase
    .from("transactions")
    .select("external_ref")
    .eq("user_id", userId)
    .in("external_ref", refs);
  const existingSet = new Set((existingRefs ?? []).map((r) => r.external_ref));

  const toInsert = rows.filter((r) => !existingSet.has(r.external_ref));
  const skipped = rows.length - toInsert.length;

  if (toInsert.length === 0) {
    return { imported: 0, skipped, source: SOURCE_LABEL[source] };
  }

  // Map category by name guess
  function findCategory(desc: string, kind: "income" | "expense"): string | null {
    const guess = guessCategory(desc);
    if (!guess) return null;
    return categories.find((c) => c.name === guess && c.kind === kind)?.id ?? null;
  }

  const payload = toInsert.map((r) => ({
    user_id: userId,
    account_id: accountId,
    category_id: findCategory(r.description, r.kind),
    amount_cents: r.amount_cents,
    kind: r.kind,
    occurred_on: r.occurred_on,
    description: r.description,
    is_recurring: false,
    external_ref: r.external_ref,
  }));

  const { error } = await supabase.from("transactions").insert(payload);
  if (error) return { imported: 0, skipped, error: error.message };

  revalidatePath("/financas");
  revalidatePath("/");
  return { imported: toInsert.length, skipped, source: SOURCE_LABEL[source] };
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
    amount: isFinite(amount) ? amount : 0,
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

export async function toggleBillPaid(id: string, paid: boolean): Promise<void> {
  const { supabase } = await requireUser();
  await supabase
    .from("bills")
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath("/financas");
  revalidatePath("/");
}

export async function deleteBill(id: string): Promise<void> {
  const { supabase } = await requireUser();
  await supabase.from("bills").delete().eq("id", id);
  revalidatePath("/financas");
}

// --- BUDGET ENVELOPES -----------------------------------------------

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
    limit: isFinite(limit) ? limit : 0,
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
