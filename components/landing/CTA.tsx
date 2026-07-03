import { Magnetic } from "@/components/Magnetic";
import { Reveal } from "@/components/Reveal";
import { TouvieEmblem } from "@/components/brand/TouvieEmblem";
import Link from "next/link";

/**
 * Seção 6 — CTA final. Fecha o círculo: o selo de novo, um convite em serifa
 * e o botão Entrar (magnético). Eco do anel "Em algum lugar, no Touvie".
 */
export function CTA() {
  return (
    <section id="cta" className="mx-auto w-full max-w-4xl px-6 py-28 text-center sm:py-36">
      <Reveal>
        <div className="mx-auto inline-flex">
          <TouvieEmblem size={300} alt="Touvie" />
        </div>
      </Reveal>
      <Reveal delay={140}>
        <h2 className="display mt-8 text-display sm:text-hero" style={{ color: "var(--color-fg)" }}>
          Seu sistema <span className="display-i gradient-text">te espera</span>.
        </h2>
      </Reveal>
      <Reveal delay={260}>
        <p
          className="mx-auto mt-5 max-w-md text-base sm:text-lg"
          style={{ color: "var(--color-fg-muted)" }}
        >
          Uma vida inteira, organizada com capricho. Entra e começa hoje.
        </p>
      </Reveal>
      <Reveal delay={380}>
        <div className="mt-10">
          <Magnetic strength={0.45} radius={90}>
            <Link
              href="/login"
              className="gradient-brand inline-flex items-center rounded-full px-8 py-3.5 text-sm font-semibold transition-shadow duration-300 hover:shadow-[0_12px_34px_rgba(224,184,62,0.30)]"
              style={{ color: "var(--color-bg)" }}
            >
              Entrar no Touvie
            </Link>
          </Magnetic>
        </div>
      </Reveal>
    </section>
  );
}
