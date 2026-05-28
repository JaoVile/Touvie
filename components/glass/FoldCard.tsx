import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

/** Extra gold accent layered on top of the shared header rule. */
type FoldCardVariant = "bookmark" | "spine";

interface FoldCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: FoldCardVariant;
  /** Editorial figure shown in the corner (e.g. 1 → "01"). */
  index?: number;
}

/**
 * Glass card. Every card gets a gold gradient hairline under its header
 * (the `.fold-card .card-head` rule), a glass top highlight, and a hovered
 * icon chip. An optional `variant` adds a second accent on top:
 * - `bookmark`  a ribbon page-marker peeking from the top edge.
 * - `spine`     a vertical gold bar on the left edge.
 * An optional `index` prints an editorial figure in the corner.
 *
 * Entrance motion is handled by a wrapping <Reveal>, not the card itself.
 */
export function FoldCard({ className, children, variant, index, ...rest }: FoldCardProps) {
  return (
    <div className={cn("fold-card", variant && `fold-card--${variant}`, className)} {...rest}>
      <div className="fold-card__body">
        {index != null && (
          <span className="fold-card__index" aria-hidden="true">
            {String(index).padStart(2, "0")}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}
