import { KCAL_PER_GRAM, type Macros, macroPercents } from "@/lib/diet";

interface Props {
  macros: Macros;
}

export function MacrosBar({ macros }: Props) {
  const pct = macroPercents(macros);
  const totalKcal = Math.round(macros.kcal);
  const empty = totalKcal === 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat label="kcal" value={totalKcal.toString()} color="var(--color-accent)" />
        <Stat label="P" value={`${macros.protein_g.toFixed(0)}g`} color="#22c55e" />
        <Stat label="C" value={`${macros.carb_g.toFixed(0)}g`} color="#f59e0b" />
        <Stat label="G" value={`${macros.fat_g.toFixed(0)}g`} color="#ec4899" />
      </div>

      {!empty ? (
        <>
          <div
            className="flex h-3 overflow-hidden rounded-full"
            style={{ background: "var(--color-card)" }}
            role="img"
            aria-label={`Composição: ${pct.protein}% proteína, ${pct.carb}% carbo, ${pct.fat}% gordura`}
          >
            <div style={{ width: `${pct.protein}%`, background: "#22c55e" }} />
            <div style={{ width: `${pct.carb}%`, background: "#f59e0b" }} />
            <div style={{ width: `${pct.fat}%`, background: "#ec4899" }} />
          </div>
          <div
            className="flex justify-between text-[10px]"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            <span>P {pct.protein}%</span>
            <span>C {pct.carb}%</span>
            <span>G {pct.fat}%</span>
            <span>fibra {macros.fiber_g.toFixed(0)}g</span>
          </div>
        </>
      ) : (
        <p className="text-center text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          Sem refeições registradas neste dia.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-lg px-2 py-1.5"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      <div
        className="text-[10px] uppercase tracking-wide"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        {label}
      </div>
      <div className="font-mono text-base font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
