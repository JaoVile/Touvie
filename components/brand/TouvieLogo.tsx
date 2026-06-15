import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

/**
 * A marca do Touvie como componente reutilizável — serve os SVGs vetoriais de
 * /public/brand (montagem 2026-06-11: T caligráfico varrido por uma órbita,
 * estrelas e notas). O lockup (emblema + "Touvie") é transparente e assenta
 * sobre qualquer fundo.
 *
 * `size` é a ALTURA; a largura sai da proporção real de cada arte (o lockup é
 * ~quadrado, a mark solta é paisagem ~1.4:1). `animated` liga a respiração +
 * brilho sutil, respeitando `prefers-reduced-motion` (ver globals.css).
 */
const LOCKUP_RATIO = 1264 / 1243; // touvie-logo-alt.svg (viewBox pós-recorte)
const MARK_RATIO = 1543 / 1103; // touvie-mark.svg

export function TouvieLogo({
  size = 96,
  animated = false,
  priority = false,
  emblem = false,
  className,
  style,
  alt = "Touvie",
}: {
  /** Altura em px; a largura segue a proporção da arte. */
  size?: number;
  animated?: boolean;
  priority?: boolean;
  /** `true` serve só o emblema (touvie-mark.svg, sem o wordmark) — header/ícone. */
  emblem?: boolean;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}) {
  const src = emblem ? "/brand/touvie-mark.svg" : "/brand/touvie-logo-alt.svg";
  const ratio = emblem ? MARK_RATIO : LOCKUP_RATIO;
  return (
    <img
      src={src}
      width={Math.round(size * ratio)}
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
