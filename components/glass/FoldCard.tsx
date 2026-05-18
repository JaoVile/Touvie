import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

interface FoldCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Glass card with a folded top-right corner (origami motif).
 * - `.fold-card`        wrapper — owns shadow + hover lift.
 * - `.fold-card__body`  clipped glass surface (the cut corner).
 * - `.fold-card__flap`  the folded-back triangle with a glowing crease.
 *
 * Entrance motion is handled by a wrapping <Reveal>, not the card itself.
 */
export function FoldCard({ className, children, ...rest }: FoldCardProps) {
  return (
    <div className={cn("fold-card", className)} {...rest}>
      <div className="fold-card__body">{children}</div>
      <span className="fold-card__flap" aria-hidden="true" />
    </div>
  );
}
