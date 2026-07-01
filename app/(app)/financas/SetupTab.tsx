import { GlassCard } from "@/components/glass/GlassCard";
import { formatBRL } from "@/lib/utils";
import { Tags, Wallet } from "lucide-react";
import { AdjustBalanceButton } from "./AdjustBalanceButton";
import { CategoryForm } from "./CategoryForm";
import { CategoryRow } from "./CategoryRow";
import { ResetFinancesButton } from "./ResetFinancesButton";
import { SeedCategoriesButton } from "./SeedCategoriesButton";

interface Category {
  id: string;
  name: string;
  kind: "income" | "expense";
  emoji: string | null;
  color: string | null;
}

interface Props {
  saldoTotal: number;
  categories: Category[];
}

export function SetupTab({ saldoTotal, categories }: Props) {
  const incomeCats = categories.filter((c) => c.kind === "income");
  const expenseCats = categories.filter((c) => c.kind === "expense");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GlassCard>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Wallet size={16} />
          Saldo
        </h2>
        <div
          className="mb-3 flex items-center justify-between rounded-xl border p-4"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        >
          <div>
            <div
              className="text-[10px] uppercase tracking-wide"
              style={{ color: "var(--color-fg-subtle)" }}
            >
              Saldo total
            </div>
            <div
              className="mt-0.5 font-mono text-2xl font-semibold"
              style={{ color: saldoTotal < 0 ? "var(--color-danger)" : "var(--color-fg)" }}
            >
              {formatBRL(saldoTotal)}
            </div>
          </div>
          <AdjustBalanceButton currentCents={saldoTotal} />
        </div>
        <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
          O saldo vem dos seus lançamentos. Se a realidade for outra, use{" "}
          <strong>Ajustar saldo</strong> pra digitar o valor real — a gente gera o ajuste pela
          diferença.
        </p>
        <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
          <ResetFinancesButton />
          <p className="mt-1.5 text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
            Limpa lançamentos, contas a pagar e caixinhas (zera saldo e gráfico). Mantém categorias.
          </p>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Tags size={16} />
            Categorias
          </h2>
          {categories.length === 0 ? <SeedCategoriesButton /> : null}
        </div>

        {categories.length > 0 ? (
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <CategoryGroup title="Despesas" categories={expenseCats} />
            <CategoryGroup title="Receitas" categories={incomeCats} />
          </div>
        ) : (
          <p className="mb-3 text-xs" style={{ color: "var(--color-fg-muted)" }}>
            Sem categorias ainda. Use o botão acima pra carregar um conjunto padrão em PT-BR ou crie
            a sua abaixo.
          </p>
        )}

        <h3
          className="mb-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          Nova categoria
        </h3>
        <CategoryForm />
      </GlassCard>
    </div>
  );
}

function CategoryGroup({ title, categories }: { title: string; categories: Category[] }) {
  return (
    <div>
      <h3
        className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        {title}
      </h3>
      {categories.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          —
        </p>
      ) : (
        <ul className="space-y-1">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
        </ul>
      )}
    </div>
  );
}
