import type { ReactNode } from "react";

interface GradientHeaderProps {
  emoji?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function GradientHeader({ emoji, title, subtitle, action }: GradientHeaderProps) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {emoji ? <span className="mr-3">{emoji}</span> : null}
          <span className="gradient-text">{title}</span>
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm" style={{ color: "var(--color-fg-muted)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </header>
  );
}
