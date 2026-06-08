import { CardHead } from "@/components/glass/CardHead";
import { FoldCard } from "@/components/glass/FoldCard";
import { formatBRL } from "@/lib/utils";
import { Wallet } from "lucide-react";
import { CardLink, EmptyState } from "./shared";

export function FinanceCard({
  hasTransactions,
  monthIncome,
  monthExpense,
  monthNet,
}: {
  hasTransactions: boolean;
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
}) {
  return (
    <FoldCard index={4}>
      <CardHead icon={Wallet} title="Mês corrente" />
      {!hasTransactions ? (
        <EmptyState href="/financas" label="Lançar">
          Nenhum lançamento neste mês.
        </EmptyState>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span style={{ color: "var(--color-fg-muted)" }}>Receitas</span>
            <span className="font-mono" style={{ color: "var(--color-success)" }}>
              {formatBRL(monthIncome)}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "var(--color-fg-muted)" }}>Despesas</span>
            <span className="font-mono" style={{ color: "var(--color-danger)" }}>
              {formatBRL(monthExpense)}
            </span>
          </div>
          <div
            className="flex justify-between border-t pt-2"
            style={{ borderColor: "var(--color-border)" }}
          >
            <span className="font-semibold">Saldo</span>
            <span
              className="font-mono font-semibold"
              style={{
                color: monthNet >= 0 ? "var(--color-success)" : "var(--color-danger)",
              }}
            >
              {formatBRL(monthNet)}
            </span>
          </div>
        </div>
      )}

      <div className="mt-auto">
        <CardLink href="/financas?t=graficos">Ver gráficos</CardLink>
        <p
          className="mt-3 border-t pt-3 text-[0.7rem] italic"
          style={{ borderColor: "var(--color-border)", color: "var(--color-fg-subtle)" }}
        >
          "A maneira mais confiável de prever o futuro é criá-lo."
        </p>
      </div>
    </FoldCard>
  );
}
