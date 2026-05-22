import type { ReactNode } from "react";

interface CardHeadProps {
  icon: string;
  title: string;
  badge?: ReactNode;
}

/**
 * Section header inside a card — icon chip + tracked uppercase label,
 * with an optional trailing badge. The dashboard's card language,
 * shared so internal pages read the same way.
 */
export function CardHead({ icon, title, badge }: CardHeadProps) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.6rem] text-sm"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
      >
        {icon}
      </span>
      <h2
        className="text-label font-bold uppercase tracking-[0.13em]"
        style={{ color: "var(--color-fg-muted)" }}
      >
        {title}
      </h2>
      {badge}
    </div>
  );
}
