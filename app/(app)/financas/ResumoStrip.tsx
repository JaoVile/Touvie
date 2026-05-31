import { formatBRL } from "@/lib/utils";

interface Props {
  patrimonio: number; // soma dos saldos atuais (dívida de cartão entra negativa)
  dividaCartao: number; // soma das dívidas de cartão (positivo)
  aPagar: number; // contas pendentes
  sobraMes: number; // receitas - despesas do mês corrente
}

export function ResumoStrip({ patrimonio, dividaCartao, aPagar, sobraMes }: Props) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Card
        label="Patrimônio"
        value={formatBRL(patrimonio)}
        color={patrimonio >= 0 ? "var(--color-fg)" : "var(--color-danger)"}
        hint="saldo de todas as contas"
      />
      <Card
        label="Fatura / dívida"
        value={formatBRL(dividaCartao)}
        color={dividaCartao > 0 ? "var(--color-danger)" : "var(--color-fg-muted)"}
        hint="cartões de crédito"
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
      <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--color-fg-subtle)" }}>
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
