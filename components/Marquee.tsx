import type { CSSProperties, ReactNode } from "react";

/**
 * Editorial marquee / ticker. CSS-only horizontal scroll — duplicates the
 * content twice in the DOM so the loop seam is invisible. GPU-accelerated
 * via `transform: translateX`; pauses on hover and under prefers-reduced-
 * motion (handled by the keyframe rule in app/globals.css).
 *
 * Tuning via props:
 *   - duration       seconds for one full loop (lower = faster)
 *   - direction      "left" (default) or "right"
 *   - gap            spacing between repeated items (CSS length)
 *   - pauseOnHover   whether hovering halts the scroll
 *   - className      typically used to set text size / color
 */
export interface MarqueeProps {
  children: ReactNode;
  duration?: number;
  direction?: "left" | "right";
  gap?: string;
  pauseOnHover?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Marquee({
  children,
  duration = 40,
  direction = "left",
  gap = "3rem",
  pauseOnHover = true,
  className,
  style,
}: MarqueeProps) {
  return (
    <div
      className={`marquee ${pauseOnHover ? "marquee--pauseable" : ""} ${className ?? ""}`.trim()}
      style={
        {
          "--marquee-duration": `${duration}s`,
          "--marquee-direction": direction === "left" ? "normal" : "reverse",
          "--marquee-gap": gap,
          ...style,
        } as CSSProperties
      }
    >
      <div className="marquee__track">
        <div className="marquee__group" aria-hidden={false}>
          {children}
        </div>
        {/* Duplicate hidden from assistive tech — purely visual loop. */}
        <div className="marquee__group" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
