import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

/**
 * A marca *viva*. A arte fiel (touvie-mark.svg — emblema sem wordmark) fica de
 * base; uma camada leve se move POR CIMA sem tocá-la: o ouro reluz num shimmer
 * (clipado à forma do emblema via mask), dois satélites orbitam o centro, a
 * estrela cintila e notinhas sobem — o eco do "cursor que canta".
 *
 * As posições (% do viewBox do mark, 286.3 236.5 437.3 437.3) vêm das
 * coordenadas reais medidas na arte. Toda a animação é CSS (ver globals.css,
 * classes `te-*`) e respeita `prefers-reduced-motion`.
 */
const STAR: CSSProperties = { left: "51.6%", top: "17.9%" };

const NOTES: CSSProperties[] = [
  { left: "85%", top: "53%", animationDelay: "0s" },
  { left: "81%", top: "37%", animationDelay: "1.7s" },
  { left: "86%", top: "70%", animationDelay: "3.1s" },
];

const ORBITS = [
  {
    key: "a",
    small: false,
    vars: { "--tilt": "32deg", "--flat": "0.4", "--dur": "9s", "--r": "9%" },
  },
  {
    key: "b",
    small: true,
    vars: { "--tilt": "-30deg", "--flat": "0.42", "--dur": "13s", "--delay": "-5s", "--r": "12%" },
  },
];

export function TouvieEmblem({
  size = 220,
  className,
  style,
  alt = "Touvie",
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}) {
  return (
    <div className={cn("te-root", className)} style={{ width: size, height: size, ...style }}>
      <img
        src="/brand/touvie-mark.svg"
        alt={alt}
        width={size}
        height={size}
        className="te-art"
        draggable={false}
        decoding="async"
      />
      <span aria-hidden="true" className="te-shimmer" />
      {ORBITS.map((o) => (
        <span key={o.key} aria-hidden="true" className="te-orbit" style={o.vars as CSSProperties}>
          <span className="te-spin">
            <span className={cn("te-sat", o.small && "te-sat--sm")} />
          </span>
        </span>
      ))}
      <span aria-hidden="true" className="te-twinkle" style={STAR} />
      {NOTES.map((n) => (
        <span key={`${n.left}-${n.top}`} aria-hidden="true" className="te-note" style={n} />
      ))}
    </div>
  );
}
