import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";
import { FoldCard } from "./FoldCard";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Render with the folded-corner (origami) treatment. */
  fold?: boolean;
  /** Entrance-stagger delay in ms. */
  delay?: number;
}

/**
 * Standard glass surface used across the app.
 * Pass `fold` to opt a prominent card into the folded-corner motif.
 */
export function GlassCard({
  className,
  children,
  fold = false,
  delay = 0,
  style,
  ...rest
}: GlassCardProps) {
  if (fold) {
    return (
      <FoldCard className={className} style={style} {...rest}>
        {children}
      </FoldCard>
    );
  }

  return (
    <div
      className={cn("glass rise-in p-5", className)}
      style={delay ? { animationDelay: `${delay}ms`, ...style } : style}
      {...rest}
    >
      {children}
    </div>
  );
}
