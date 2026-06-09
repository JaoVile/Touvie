import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

/**
 * A marca do Touvie (Monograma Celeste) como componente reutilizável — serve o
 * SVG vetorial *transparente* salvo em /public/brand (lockup: emblema +
 * wordmark "Touvie"), que assenta sobre qualquer fundo.
 *
 * `animated` liga uma respiração + brilho sutil (eco do "cursor que canta"),
 * respeitando `prefers-reduced-motion` (ver globals.css). Para animar *partes*
 * (órbitas, notas, fita) seria preciso um SVG inline estruturado — ver o
 * roadmap de animação / TouvieMark.
 */
export function TouvieLogo({
  size = 96,
  animated = false,
  priority = false,
  emblem = false,
  className,
  style,
  alt = "Touvie",
}: {
  size?: number;
  animated?: boolean;
  priority?: boolean;
  /** `true` serve só o emblema (touvie-mark.svg, sem o wordmark) — header/favicon. */
  emblem?: boolean;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}) {
  const src = emblem ? "/brand/touvie-mark.svg" : "/brand/touvie-logo-alt.svg";
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={cn("block", animated && "touvie-logo-anim", className)}
      style={style}
    />
  );
}
