import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface CardHeadProps {
  icon: LucideIcon;
  title: string;
  badge?: ReactNode;
}

/**
 * Section header inside a card — line icon chip + tracked uppercase
 * label, with an optional trailing badge. The dashboard's card
 * language, shared so internal pages read the same way.
 */
export function CardHead({ icon: Icon, title, badge }: CardHeadProps) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.6rem]"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
      >
        <Icon size={15} strokeWidth={1.75} style={{ color: "var(--color-accent)" }} />
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
