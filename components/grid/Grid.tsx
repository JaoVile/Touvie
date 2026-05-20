import { cn } from "@/lib/utils";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { Reveal } from "@/components/Reveal";

/**
 * Editorial column grid, ported from the design guide
 * (obsidianassembly.com). Resolves to 12 columns on desktop, 6 on
 * tablet and a single stack on mobile — the layout logic lives in
 * `.grid-editorial` in globals.css (gutter tunable via --grid-gap).
 *
 * Place children with <Col span={…}> for asymmetric, offset blocks.
 */
export function Grid({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("grid-editorial", className)} {...rest}>
      {children}
    </div>
  );
}

interface ColProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Columns to span on desktop (of 12). Default 12 — full width. */
  span?: number;
  /** Columns to span on tablet (of 6). Default 6 — full width. */
  spanSm?: number;
  /** 1-based desktop start column — for offset / indented blocks. */
  start?: number;
  /** Wrap the cell's content in a scroll-aware <Reveal> entrance. */
  reveal?: boolean;
  /** Reveal stagger delay in ms (only meaningful with `reveal`). */
  delay?: number;
}

/**
 * A placed cell inside <Grid>. Spans are plain numbers so they stay
 * trivial to retune; they feed the CSS custom properties the grid
 * reads. Pass `reveal` to give the cell the app's entrance motion.
 */
export function Col({
  span = 12,
  spanSm = 6,
  start,
  reveal = false,
  delay = 0,
  className,
  style,
  children,
  ...rest
}: ColProps) {
  return (
    <div
      className={cn(className)}
      style={
        {
          "--col-lg": span,
          "--col-sm": spanSm,
          ...(start ? { "--col-start": start } : {}),
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      {reveal ? (
        <Reveal className="h-full" delay={delay}>
          {children}
        </Reveal>
      ) : (
        children
      )}
    </div>
  );
}
