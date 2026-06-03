import { formatBRL } from "@/lib/utils";

interface Props {
  saldoTotal: number; // soma de tudo
  aPagar: number; // contas pendentes
  sobraMes: number; // receitas - despesas do mês corrente
}

export function ResumoStrip({ saldoTotal, aPagar, sobraMes }: Props) {
  return (
    <div className="mb-4 grid grid-cols-3 gap-2">
      <Card
        label="Saldo total"
        value={formatBRL(saldoTotal)}
        color={saldoTotal >= 0 ? "var(--color-fg)" : "var(--color-danger)"}
        hint="tudo o que você tem"
      />
      <Card
        label="A pagar"
        value={formatBRL(aPagar)}
        color={aPagar > 0 ? "var(--color-accent)" : "var(--color-fg-muted)"}
        hint="contas pendentes"
      />
      <Card
        label="Sobra do mês"
        value={formatBRL(sobraMes)}
        color={sobraMes >= 0 ? "var(--color-success)" : "var(--color-danger)"}
        hint="receitas − despesas"
      />
    </div>
  );
}

function Card({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: string;
  color: string;
  hint: string;
}) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      <div
        className="text-[10px] uppercase tracking-wide"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        {label}
      </div>
      <div className="mt-0.5 font-mono text-base font-semibold sm:text-lg" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
        {hint}
      </div>
    </div>
  );
}
