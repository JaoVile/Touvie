import { AnimatedCounter } from "@/components/AnimatedCounter";
import { Marquee } from "@/components/Marquee";
import { Reveal } from "@/components/Reveal";
import type { CSSProperties } from "react";

const STATS: { to: number; suffix?: string; label: string }[] = [
  { to: 8, label: "módulos num só lugar" },
  { to: 365, label: "dias por ano, te acompanhando" },
  { to: 100, suffix: "%", label: "seu — privado de verdade" },
];

/**
 * Seção 5 — Números. Um marquee editorial gigante em serifa (faint gold)
 * como divisor, e três contadores que sobem ao entrar na tela.
 */
export function Numeros() {
  return (
    <section className="py-24 sm:py-28">
      <Reveal>
        <Marquee
          duration={48}
          repeat={3}
          className="display"
          style={
            {
              color: "color-mix(in srgb, var(--color-accent) 20%, transparent)",
              "--marquee-fade": "clamp(4rem, 18vw, 22rem)",
            } as CSSProperties
          }
        >
          <span className="text-display sm:text-hero">Em algum lugar, no Touvie</span>
          <span className="text-display sm:text-hero" style={{ color: "var(--color-accent)" }}>
            ·
          </span>
        </Marquee>
      </Reveal>

      <div className="mx-auto mt-20 grid max-w-5xl grid-cols-1 gap-12 px-6 sm:grid-cols-3">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 120} className="text-center">
            <p className="display text-hero" style={{ color: "var(--color-fg)" }}>
              <AnimatedCounter to={s.to} suffix={s.suffix} />
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--color-fg-muted)" }}>
              {s.label}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
