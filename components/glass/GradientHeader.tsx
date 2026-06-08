import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/* ── Tune here ─────────────────────────────────────────────────────
   Editorial page header. Title scale, chip size and icon weight are
   the knobs most likely to need fine-tuning. */
const CONFIG = {
  chipSize: "h-14 w-14", // rounded icon chip
  iconPx: 22, // Lucide icon size inside the chip
  iconStroke: 1.75, // Lucide stroke weight — thinner = more editorial
} as const;

interface GradientHeaderProps {
  /** Lucide icon component — the preferred, theme-matching choice. */
  icon?: LucideIcon;
  /** Legacy emoji string — fallback for pages not yet migrated. */
  emoji?: string;
  /** Small uppercase tracked label above the title — editorial eyebrow. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

/**
 * Page header — line icon in a rounded chip, big serif gradient title,
 * optional eyebrow + action. Shares the chip + uppercase-tracking
 * language of the dashboard cards.
 */
export function GradientHeader({
  icon: Icon,
  emoji,
  eyebrow,
  title,
  subtitle,
  action,
}: GradientHeaderProps) {
  const chip = Icon ? (
    <Icon
      size={CONFIG.iconPx}
      strokeWidth={CONFIG.iconStroke}
      style={{ color: "var(--color-accent)" }}
    />
  ) : emoji ? (
    <span className="text-xl">{emoji}</span>
  ) : null;

  return (
    <header
      className="mb-8 flex items-center justify-between gap-4"
      style={{ animation: "fade-in 0.5s ease-out backwards" }}
    >
      <div className="flex min-w-0 items-center gap-4">
        {chip ? (
          <span
            className={`grid ${CONFIG.chipSize} shrink-0 place-items-center rounded-2xl`}
            style={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
            }}
          >
            {chip}
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="eyebrow mb-1.5 truncate" style={{ color: "var(--color-fg-subtle)" }}>
              {eyebrow}
            </p>
          ) : null}
          <h1 className="display text-h1 leading-[1.05] sm:text-display">
            <span className="gradient-text">{title}</span>
          </h1>
          {subtitle ? (
            <p className="mt-1.5 text-sm" style={{ color: "var(--color-fg-muted)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
