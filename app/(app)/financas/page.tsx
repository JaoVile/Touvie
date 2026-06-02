import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { GlassCard } from "@/components/glass/GlassCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { todayBRTISO } from "@/lib/datetime";
import { billingCycle } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";
import { Wallet } from "lucide-react";
import { CaixinhasTab } from "./CaixinhasTab";
import { ContasTab } from "./ContasTab";
import { GraficosTab } from "./GraficosTab";
import { ImportTab } from "./ImportTab";
import { LancamentosTab } from "./LancamentosTab";
import { RecorrentesTab } from "./RecorrentesTab";
import { ResumoStrip } from "./ResumoStrip";
import { SetupTab } from "./SetupTab";
import { type FinanceTab, Tabs } from "./Tabs";

export const dynamic = "force-dynamic";

type SP = Promise<{
  t?: string;
  m?: string;
  acc?: string;
  cat?: string;
  kind?: string;
  q?: string;
}>;

const VALID_TABS: FinanceTab[] = [
  "lancamentos",
  "recorrentes",
  "contas",
  "caixinhas",
  "graficos",
  "setup",
  "importar",
];

function isTab(x: string | undefined): x is FinanceTab {
  return !!x && (VALID_TABS as string[]).includes(x);
}

export default async function FinancasPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab: FinanceTab = isTab(sp?.t) ? sp.t : "lancamentos";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const today = todayBRTISO();
  const currentMonth = today.slice(0, 7); // YYYY-MM
  const selectedMonth = /^\d{4}-\d{2}$/.test(sp?.m ?? "") ? (sp!.m as string) : currentMonth;
  const spKind = sp?.kind;
  const filters = {
    accountId: sp?.acc || null,
    categoryId: sp?.cat || null,
    kind: (spKind === "income" || spKind === "expense" ? spKind : null) as
      | "income"
      | "expense"
      | null,
    q: sp?.q?.trim() || null,
  };

  const curMonthStart = `${currentMonth}-01`;
  const curMonthEnd = new Date(
    Number.parseInt(currentMonth.slice(0, 4)),
    Number.parseInt(currentMonth.slice(5, 7)),
    0,
  )
    .toISOString()
    .slice(0, 10);

  const [accountsRes, categoriesRes, balancesRes, pendingBillsRes, monthTxRes] = await Promise.all([
    supabase
      .from("finance_accounts")
      .select("id, name, kind, balance_cents, credit_limit_cents, closing_day, due_day, archived")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("name"),
    supabase
      .from("finance_categories")
      .select("id, name, kind, emoji, color, archived")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("name"),
    supabase
      .from("finance_account_balances")
      .select("account_id, current_cents")
      .eq("user_id", userId),
    // "A pagar": só conta o que vence até o fim do mês atual (mês corrente +
    // atrasadas). Meses futuros já cadastrados (recorrentes) não inflam o total.
    supabase
      .from("bills")
      .select("amount_cents")
      .eq("user_id", userId)
      .is("paid_at", null)
      .lte("due_date", curMonthEnd),
    supabase
      .from("transactions")
      .select("amount_cents, kind")
      .eq("user_id", userId)
      .eq("is_recurring", false)
      .gte("occurred_on", curMonthStart)
      .lte("occurred_on", curMonthEnd),
  ]);

  const balanceByAccount = new Map<string, number>(
    (balancesRes.data ?? []).map((b) => [b.account_id as string, b.current_cents as number]),
  );

  const accounts = (
    (accountsRes.data ?? []) as Array<{
      id: string;
      name: string;
      kind: "cash" | "checking" | "savings" | "credit" | "investment";
      balance_cents: number;
      credit_limit_cents: number | null;
      closing_day: number | null;
      due_day: number | null;
      archived: boolean;
    }>
  ).map((a) => ({ ...a, current_cents: balanceByAccount.get(a.id) ?? a.balance_cents }));
  const categories = (categoriesRes.data ?? []) as Array<{
    id: string;
    name: string;
    kind: "income" | "expense";
    emoji: string | null;
    color: string | null;
    archived: boolean;
  }>;

  // Resumo (visível em todas as abas)
  const patrimonio = accounts.reduce((s, a) => s + a.current_cents, 0);
  const dividaCartao = accounts
    .filter((a) => a.kind === "credit" && a.current_cents < 0)
    .reduce((s, a) => s - a.current_cents, 0);
  const aPagar = (pendingBillsRes.data ?? []).reduce((s, b) => s + (b.amount_cents as number), 0);
  const monthTotals = (monthTxRes.data ?? []).reduce(
    (acc, t) => {
      if (t.kind === "income") acc.income += t.amount_cents as number;
      else acc.expense += t.amount_cents as number;
      return acc;
    },
    { income: 0, expense: 0 },
  );
  const sobraMes = monthTotals.income - monthTotals.expense;

  // Load bills + cartões for "contas" tab
  let bills: Array<{
    id: string;
    title: string;
    amount_cents: number;
    due_date: string;
    paid_at: string | null;
    recurrence_rule: string | null;
    category_id: string | null;
    notes: string | null;
  }> = [];
  let creditCards: Array<{
    id: string;
    name: string;
    current_cents: number;
    credit_limit_cents: number | null;
    due_day: number | null;
    closing_day: number | null;
    faturaAberta: number;
  }> = [];
  if (tab === "contas") {
    // Mesma regra do resumo: lista o mês atual + atrasadas; meses futuros já
    // cadastrados aparecem só quando chegar a vez deles.
    const { data } = await supabase
      .from("bills")
      .select("id, title, amount_cents, due_date, paid_at, recurrence_rule, category_id, notes")
      .eq("user_id", userId)
      .lte("due_date", curMonthEnd)
      .order("due_date", { ascending: true });
    bills = data ?? [];

    const creditAccounts = accounts.filter((a) => a.kind === "credit");
    if (creditAccounts.length > 0) {
      const refDate = new Date(`${today}T12:00:00`);
      const cycles = new Map<string, { start: string; end: string }>(
        creditAccounts.map((a) => [a.id, billingCycle(a.closing_day ?? 1, refDate)]),
      );
      const minStart = [...cycles.values()].reduce(
        (m, c) => (c.start < m ? c.start : m),
        "9999-99-99",
      );
      const maxEnd = [...cycles.values()].reduce((m, c) => (c.end > m ? c.end : m), "0000-00-00");
      const { data: cardTx } = await supabase
        .from("transactions")
        .select("account_id, amount_cents, occurred_on")
        .eq("user_id", userId)
        .eq("kind", "expense")
        .eq("is_recurring", false)
        .in(
          "account_id",
          creditAccounts.map((a) => a.id),
        )
        .gte("occurred_on", minStart)
        .lte("occurred_on", maxEnd);

      const faturaByCard: Record<string, number> = {};
      for (const t of cardTx ?? []) {
        const cyc = t.account_id ? cycles.get(t.account_id) : null;
        if (cyc && t.occurred_on >= cyc.start && t.occurred_on <= cyc.end) {
          faturaByCard[t.account_id] =
            (faturaByCard[t.account_id] ?? 0) + (t.amount_cents as number);
        }
      }
      creditCards = creditAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        current_cents: a.current_cents,
        credit_limit_cents: a.credit_limit_cents,
        due_day: a.due_day,
        closing_day: a.closing_day,
        faturaAberta: faturaByCard[a.id] ?? 0,
      }));
    }
  }

  // Load envelopes + spending for "caixinhas" tab
  let envelopes: Array<{
    id: string;
    name: string;
    emoji: string | null;
    category_id: string | null;
    month: string;
    limit_cents: number;
    spent_cents: number;
  }> = [];
  if (tab === "caixinhas") {
    const monthStart = `${selectedMonth}-01`;
    const monthEnd = new Date(
      Number.parseInt(selectedMonth.slice(0, 4)),
      Number.parseInt(selectedMonth.slice(5, 7)),
      0,
    )
      .toISOString()
      .slice(0, 10);

    const [envsRes, txsRes] = await Promise.all([
      supabase
        .from("budget_envelopes")
        .select("id, name, emoji, category_id, month, limit_cents")
        .eq("user_id", userId)
        .eq("month", selectedMonth),
      supabase
        .from("transactions")
        .select("category_id, amount_cents")
        .eq("user_id", userId)
        .eq("kind", "expense")
        .gte("occurred_on", monthStart)
        .lte("occurred_on", monthEnd),
    ]);

    const spentByCategory: Record<string, number> = {};
    for (const tx of txsRes.data ?? []) {
      if (tx.category_id)
        spentByCategory[tx.category_id] = (spentByCategory[tx.category_id] ?? 0) + tx.amount_cents;
    }

    envelopes = (envsRes.data ?? []).map((e) => ({
      ...e,
      spent_cents: e.category_id ? (spentByCategory[e.category_id] ?? 0) : 0,
    }));
  }

  const subtitleByTab: Record<FinanceTab, string> = {
    lancamentos: "Receitas e despesas do mês.",
    recorrentes: "Contas e receitas que se repetem todo mês.",
    contas: "Vencimentos e status de pagamento.",
    caixinhas: "Orçamento por categoria — controle onde vai cada real.",
    graficos: "Pra onde o dinheiro está indo.",
    importar: "Importe o extrato do Nubank ou Mercado Pago.",
    setup: "Contas e categorias.",
  };

  const noCategories = categories.length === 0;

  return (
    <>
      <PageGlyphs variant="finance" />
      <Reveal>
        <GradientHeader
          icon={Wallet}
          eyebrow="Dinheiro · Mês"
          title="Finanças"
          subtitle={subtitleByTab[tab]}
        />
      </Reveal>
      {!noCategories ? (
        <ResumoStrip
          patrimonio={patrimonio}
          dividaCartao={dividaCartao}
          aPagar={aPagar}
          sobraMes={sobraMes}
        />
      ) : null}
      <Tabs current={tab} />

      {noCategories && !["setup", "importar", "contas", "caixinhas"].includes(tab) ? (
        <GlassCard>
          <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
            Você ainda não tem categorias. Vá para <strong>Setup</strong> e clique em "Carregar
            padrões" pra começar com um conjunto pronto em PT-BR.
          </p>
        </GlassCard>
      ) : tab === "lancamentos" ? (
        <LancamentosTab
          userId={userId}
          accounts={accounts}
          categories={categories}
          month={selectedMonth}
          filters={filters}
        />
      ) : tab === "recorrentes" ? (
        <RecorrentesTab userId={userId} accounts={accounts} categories={categories} />
      ) : tab === "contas" ? (
        <ContasTab
          bills={bills}
          categories={categories}
          today={today}
          creditCards={creditCards}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
        />
      ) : tab === "caixinhas" ? (
        <CaixinhasTab envelopes={envelopes} categories={categories} currentMonth={selectedMonth} />
      ) : tab === "graficos" ? (
        <GraficosTab userId={userId} categories={categories} />
      ) : tab === "importar" ? (
        <ImportTab />
      ) : (
        <SetupTab accounts={accounts} categories={categories} />
      )}
    </>
  );
}
