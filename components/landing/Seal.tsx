import { CircleText } from "@/components/CircleText";

/**
 * Selo Touvie — monograma "T" em Pinyon dentro do anel giratório
 * "· EM ALGUM LUGAR · NO TOUVIE ·". Destilado do login e parametrizado por
 * tamanho (diâmetro em px) pra servir tanto o hero quanto o CTA final.
 *
 * As proporções (anel, corpo do T, deslocamento) vêm do selo do login:
 * o "T" da Pinyon pende à direita e tem um swash inferior-esquerdo grande,
 * então o centramento por bounding-box joga a massa visual pra direita —
 * o translate compensa (esquerda + um toque pra baixo) pra a barra do T
 * cair no centro do anel.
 */
export function Seal({
  size = 100,
  spinDuration = 14,
}: {
  size?: number;
  spinDuration?: number;
}) {
  return (
    <div className="relative inline-flex" style={{ color: "var(--color-accent)" }}>
      <CircleText
        text="· EM ALGUM LUGAR · NO TOUVIE · "
        radius={size / 2}
        spin
        spinDuration={spinDuration}
        fontSize={size * 0.085}
        letterSpacing="0.3em"
      />
      <span
        aria-hidden="true"
        className="gradient-text-anim pointer-events-none absolute inset-0 flex select-none items-center justify-center leading-none"
        style={{
          fontFamily: "var(--font-pinyon), cursive",
          fontSize: `${size * 0.6}px`,
          transform: "rotate(-6deg) translate(-0.29em, 0.13em)",
          filter:
            "drop-shadow(0 1px 0 rgba(0,0,0,0.22)) drop-shadow(0 0 14px var(--color-accent))",
        }}
      >
        T
      </span>
    </div>
  );
}
