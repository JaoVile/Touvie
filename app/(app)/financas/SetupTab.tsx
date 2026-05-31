import { GlassCard } from "@/components/glass/GlassCard";
import { ACCOUNT_KIND_EMOJIS, ACCOUNT_KIND_LABELS, type AccountKind } from "@/lib/finance";
import { formatBRL } from "@/lib/utils";
import { AccountForm } from "./AccountForm";
import { CategoryForm } from "./CategoryForm";
import { CategoryRow } from "./CategoryRow";
import { SeedCategoriesButton } from "./SeedCategoriesButton";

interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  balance_cents: number;
  current_cents: number;
}
interface Category {
  id: string;
  name: string;
  kind: "income" | "expense";
  emoji: string | null;
  color: string | null;
}

interface Props {
  accounts: Account[];
  categories: Category[];
}

export function SetupTab({ accounts, categories }: Props) {
  const incomeCats = categories.filter((c) => c.kind === "income");
  const expenseCats = categories.filter((c) => c.kind === "expense");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GlassCard>
        <h2 className="mb-3 text-sm font-semibold">🏦 Contas</h2>
        {accounts.length === 0 ? (
          <p className="mb-3 text-xs" style={{ color: "var(--color-fg-muted)" }}>
            Crie a primeira conta abaixo.
          </p>
        ) : (
          <ul className="mb-4 space-y-1.5">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--color-card)" }}
              >
                <span>
                  <span className="mr-2">{ACCOUNT_KIND_EMOJIS[a.kind]}</span>
                  <span className="font-medium">{a.name}</span>
                  <span className="ml-2 text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
                    {ACCOUNT_KIND_LABELS[a.kind]}
                  </span>
                </span>
                <span className="flex flex-col items-end leading-tight">
                  <span
                    className="font-mono text-sm"
                    style={{ color: a.current_cents < 0 ? "var(--color-danger)" : "var(--color-fg)" }}
                  >
                    {formatBRL(a.current_cents)}
                  </span>
                  {a.current_cents !== a.balance_cents ? (
                    <span className="font-mono text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
                      inicial {formatBRL(a.balance_cents)}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        <h3
          className="mb-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          Nova conta
        </h3>
        <AccountForm />
      </GlassCard>

      <GlassCard>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">🏷️ Categorias</h2>
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
