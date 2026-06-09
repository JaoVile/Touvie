import type { CSSProperties } from "react";

/**
 * Marca do Touvie — "Monograma Celeste": o "T" em Pinyon (a assinatura) pousado
 * num disco-nebulosa navy→gold, cercado de estrelas e cruzado por um cometa. Diz
 * as duas coisas de uma vez: a *imensidão* (o céu) e *um lugar só* (o emblema).
 *
 * SVG paramétrico (viewBox 0–100), três variantes:
 *  - "nebula"  — disco preenchido + estrelas + cometa (a versão cheia / selo).
 *  - "ring"    — sem disco, só o anel + estrelas (mais leve, eco do selo atual).
 *  - "minimal" — disco + T + uma estrela (a que sobrevive a 16px / favicon).
 *
 * O "T" é <text> com a fonte Pinyon real (resolve via --font-pinyon do tema). O
 * empurrão/rotação do glyph compensa o swash inferior-esquerdo, como no Seal —
 * é o número que mais vale ajustar a olho.
 */
type Variant = "nebula" | "ring" | "minimal";

const STARS: { x: number; y: number; r: number; o: number }[] = [
  { x: 27, y: 25, r: 1.5, o: 0.9 },
  { x: 73, y: 21, r: 1.1, o: 0.7 },
  { x: 79, y: 53, r: 0.9, o: 0.55 },
  { x: 21, y: 58, r: 1.0, o: 0.6 },
  { x: 65, y: 75, r: 1.3, o: 0.8 },
  { x: 39, y: 79, r: 0.8, o: 0.5 },
];

export function TouvieMark({
  size = 96,
  variant = "nebula",
  className,
  style,
}: {
  size?: number;
  variant?: Variant;
  className?: string;
  style?: CSSProperties;
}) {
  const showDisc = variant !== "ring";
  const stars = variant === "minimal" ? STARS.slice(0, 1) : STARS;
  const showComet = variant === "nebula";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={style}
      role="img"
      aria-label="Touvie"
    >
      <defs>
        <radialGradient id="tm-neb" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#2a356b" />
          <stop offset="48%" stopColor="#161f4a" />
          <stop offset="100%" stopColor="#08112e" />
        </radialGradient>
        <linearGradient id="tm-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c9a227" />
          <stop offset="100%" stopColor="#f5dd8e" />
        </linearGradient>
        <radialGradient id="tm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e0b83e" stopOpacity="0.5" />
          <stop offset="70%" stopColor="#e0b83e" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* disco-nebulosa */}
      {showDisc ? <circle cx="50" cy="50" r="48" fill="url(#tm-neb)" /> : null}

      {/* anéis dourados — fino externo + hairline interno (editorial) */}
      <circle
        cx="50"
        cy="50"
        r="48"
        fill="none"
        stroke="url(#tm-gold)"
        strokeWidth={variant === "ring" ? 1 : 0.8}
        opacity="0.65"
      />
      {variant !== "minimal" ? (
        <circle cx="50" cy="50" r="43.5" fill="none" stroke="#e0b83e" strokeWidth="0.4" opacity="0.28" />
      ) : null}

      {/* estrelas — as frentes da vida espalhadas no firmamento */}
      {stars.map((s) => (
        <circle key={`${s.x}-${s.y}`} cx={s.x} cy={s.y} r={s.r} fill="#f5dd8e" opacity={s.o} />
      ))}

      {/* cometa — risco com cabeça, no quadrante superior */}
      {showComet ? (
        <g>
          <line
            x1="57"
            y1="31"
            x2="74"
            y2="17"
            stroke="url(#tm-gold)"
            strokeWidth="0.8"
            strokeLinecap="round"
            opacity="0.45"
          />
          <circle cx="57" cy="31" r="1.4" fill="#f5dd8e" />
        </g>
      ) : null}

      {/* brilho difuso atrás do monograma */}
      <circle cx="50" cy="52" r="22" fill="url(#tm-glow)" />

      {/* o T em Pinyon — assinatura; rotação+nudge compensam o swash */}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fill="url(#tm-gold)"
        transform="rotate(-5 50 50) translate(-3 4)"
        style={{ fontFamily: "var(--font-pinyon), cursive", fontSize: "58px" }}
      >
        T
      </text>
    </svg>
  );
}
