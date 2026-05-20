import type { CSSProperties } from "react";
import { useId } from "react";

/**
 * Editorial circular/arc text — uses SVG <textPath> so the string remains
 * real, copyable, screen-reader-friendly text that follows a curve.
 *
 * Tune the visual feel via props at the call site:
 *   - radius          how big the curve is (in px)
 *   - arc             "full" closed circle (rotatable) or "top" 180° arc
 *   - spin            slow rotation (only meaningful for arc="full")
 *   - spinDuration    seconds per full revolution
 *   - startOffset     0–1, where along the path the first letter sits
 *   - fontSize        in px (kept in px for predictable arc fitting)
 *   - letterSpacing   CSS letter-spacing, default 0.2em (editorial feel)
 *
 * Color: inherits via `currentColor` — set color on the parent or pass
 * style/className. Animation keyframes live in app/globals.css.
 */
export interface CircleTextProps {
  text: string;
  radius?: number;
  arc?: "full" | "top";
  spin?: boolean;
  spinDuration?: number;
  startOffset?: number;
  fontSize?: number;
  letterSpacing?: string;
  className?: string;
  style?: CSSProperties;
}

export function CircleText({
  text,
  radius = 60,
  arc = "full",
  spin = false,
  spinDuration = 18,
  startOffset = 0,
  fontSize = 11,
  letterSpacing = "0.2em",
  className,
  style,
}: CircleTextProps) {
  const id = useId();
  const pad = fontSize * 1.8; // breathing room so letters don't get clipped

  const width = radius * 2 + pad * 2;
  const height = arc === "full" ? width : radius + pad * 1.5;
  const cx = width / 2;
  const cy = arc === "full" ? height / 2 : height - pad / 2;

  // For "full": closed circle drawn clockwise from the top, so text flows
  // clockwise reading naturally. For "top": a 180° arc from left to right
  // along the upper half.
  const d =
    arc === "full"
      ? `M ${cx},${cy - radius} a ${radius},${radius} 0 1,1 0,${radius * 2} a ${radius},${radius} 0 1,1 0,-${radius * 2}`
      : `M ${cx - radius},${cy} A ${radius},${radius} 0 0,1 ${cx + radius},${cy}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{
        animation: spin ? `circle-text-spin ${spinDuration}s linear infinite` : undefined,
        transformOrigin: "center",
        ...style,
      }}
      aria-label={text}
      role="img"
    >
      <defs>
        <path id={id} d={d} fill="none" />
      </defs>
      <text fill="currentColor" style={{ fontSize, letterSpacing }}>
        <textPath href={`#${id}`} startOffset={`${startOffset * 100}%`}>
          {text}
        </textPath>
      </text>
    </svg>
  );
}
