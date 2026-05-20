import type { ReactNode } from "react";

interface GradientHeaderProps {
  emoji?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

/**
 * Page header — emoji in a rounded chip, gradient title, optional action.
 * Shares the chip + uppercase-tracking language of the dashboard cards.
 */
export function GradientHeader({ emoji, title, subtitle, action }: GradientHeaderProps) {
  return (
    <header
      className="mb-7 flex items-center justify-between gap-4"
      style={{ animation: "fade-in 0.5s ease-out backwards" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        {emoji ? (
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl"
            style={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
            }}
          >
            {emoji}
          </span>
        ) : null}
        <div className="min-w-0">
          <h1 className="display truncate text-h2 sm:text-h1">
            <span className="gradient-text">{title}</span>
          </h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-sm" style={{ color: "var(--color-fg-muted)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
