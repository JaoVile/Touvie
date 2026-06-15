import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";
import { MarkArt } from "./MarkArt";

/**
 * A marca *viva*, animada por camadas REAIS: o MarkArt empilha camadas-svg
 * no palco 3D (.te-stage, preserve-3d) — cada anel da auréola num BALANÇO
 * próprio que parte do repouso e volta (sem volta completa: a composição
 * original fica legível o tempo todo): o arco grosso pende no plano (com a
 * fagulha-cabeça na ponta), o arco de cima balança pra cima/baixo (eixo X)
 * e o traço fino de um lado pro outro (eixo Y), ganhando profundidade real
 * (depth sorting). O T fica firme; estrelas respiram e derivam, a clave
 * pende, as notinhas dançam. Por cima, spans somam brilho: glow nas
 * estrelas e pings arpejo na clave/notas.
 *
 * Tudo CSS (classes te-* no globals.css), respeitando reduced-motion.
 * O box é QUADRADO (size × size): o viewBox das camadas é o palco do disco
 * de rotação ("68 -270 1900 1900") — giro nunca corta; a arte estática
 * ocupa o miolo (~81% da largura). Spans em % do palco (centros medidos).
 */
type Spot = CSSProperties & Record<`--te-${string}`, string>;

/** Glow cintilante por cima das 3 estrelas da arte. */
const STARS: Spot[] = [
  { left: "35.0%", top: "31.0%", "--te-glow-scale": "1", "--te-glow-delay": "0s" },
  { left: "58.4%", top: "27.5%", "--te-glow-scale": "0.62", "--te-glow-delay": "1.4s" },
  { left: "44.4%", top: "72.7%", "--te-glow-scale": "0.62", "--te-glow-delay": "2.6s" },
];

/** Pings de luz: clave → nota → nota, um arpejo por ciclo. */
const CHIMES: Spot[] = [
  { left: "85.2%", top: "45.1%", "--te-chime-delay": "0s", "--te-chime-scale": "1.3" },
  { left: "80.9%", top: "50.9%", "--te-chime-delay": "0.35s", "--te-chime-scale": "1" },
  { left: "74.1%", top: "53.2%", "--te-chime-delay": "0.7s", "--te-chime-scale": "0.85" },
];

export function TouvieEmblem({
  size = 280,
  className,
  style,
  alt = "Touvie",
}: {
  /** Lado do palco quadrado em px (a arte ocupa ~81% da largura dele). */
  size?: number;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}) {
  return (
    <div className={cn("te-root", className)} style={{ width: size, height: size, ...style }}>
      <MarkArt title={alt || undefined} />
      {STARS.map((s, i) => (
        <span key={`star-${i}`} aria-hidden="true" className="te-star" style={s} />
      ))}
      {CHIMES.map((c, i) => (
        <span key={`chime-${i}`} aria-hidden="true" className="te-chime" style={c} />
      ))}
    </div>
  );
}
