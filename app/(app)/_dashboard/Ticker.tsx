import { Marquee } from "@/components/Marquee";

const ITEMS = [
  "Touvie",
  "Rotina",
  "Metas",
  "Tarefas",
  "Finanças",
  "Hábitos",
  "Diário",
  "Editorial · 2026",
];

export function Ticker() {
  return (
    <div className="mb-6 border-y py-3" style={{ borderColor: "var(--color-border)" }}>
      <Marquee
        duration={48}
        gap="2.5rem"
        className="eyebrow"
        style={{ color: "var(--color-accent)", "--marquee-fade": "48px" } as React.CSSProperties}
      >
        {ITEMS.map((label) => (
          <span key={label}>
            <span style={{ opacity: 0.5 }}>✦</span>&nbsp;&nbsp;{label}
          </span>
        ))}
      </Marquee>
    </div>
  );
}
