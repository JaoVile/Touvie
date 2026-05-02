import { GlassCard } from "@/components/glass/GlassCard";
import { weekRangeLabelBR } from "@/lib/datetime";
import Link from "next/link";

interface Props {
  currentWeekStart: string;
  entries: Array<{ week_start: string; content: string; updated_at: string }>;
}

export function WeekList({ currentWeekStart, entries }: Props) {
  return (
    <GlassCard className="lg:sticky lg:top-20 lg:self-start">
      <h2 className="mb-3 text-sm font-semibold">Semanas anteriores</h2>
      {entries.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
          Sem outras entradas ainda.
        </p>
      ) : (
        <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
          {entries.slice(0, 30).map((e) => {
            const active = e.week_start === currentWeekStart;
            return (
              <li key={e.week_start}>
                <Link
                  href={`/diario?w=${e.week_start}`}
                  className="block rounded px-2 py-1.5 text-xs transition hover:opacity-90"
                  style={{
                    background: active ? "var(--color-accent)" : "var(--color-card)",
                    color: active ? "white" : "var(--color-fg)",
                  }}
                >
                  <div className="font-mono">{weekRangeLabelBR(e.week_start)}</div>
                  <div className="mt-0.5 text-[10px] opacity-70">{preview(e.content)}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}

function preview(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "(vazio)";
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
}
