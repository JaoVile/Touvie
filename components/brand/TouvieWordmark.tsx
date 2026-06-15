import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

/**
 * O wordmark "Touvie" (recortado do lockup — "Tou" dourado, "vie" creme) com
 * vida própria: uma emanação de luz respira atrás das letras e um sheen
 * dourado varre o texto, clipado pelo próprio glifo (mask). Classes tw-* no
 * globals.css; respeita reduced-motion. `height` em px (arte ~3.65:1).
 */
const WORDMARK_RATIO = 807 / 221;

export function TouvieWordmark({
  height = 56,
  className,
  style,
  alt = "Touvie",
}: {
  height?: number;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}) {
  return (
    <span
      className={cn("tw-root", className)}
      style={{ width: Math.round(height * WORDMARK_RATIO), height, ...style }}
    >
      <span aria-hidden="true" className="tw-glow" />
      <img
        src="/brand/touvie-wordmark.svg"
        alt={alt}
        width={Math.round(height * WORDMARK_RATIO)}
        height={height}
        className="tw-art"
        draggable={false}
        decoding="async"
      />
      <span aria-hidden="true" className="tw-sheen" />
    </span>
  );
}
