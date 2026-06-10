import { Reveal } from "@/components/Reveal";

/**
 * Seção 2 — Manifesto. Uma única frase editorial gigante, com o porquê do
 * Touvie. A segunda metade vem mais discreta, com um realce em itálico
 * gradiente — o momento de respiro depois do hero.
 */
export function Manifesto() {
  return (
    <section id="manifesto" className="mx-auto w-full max-w-6xl px-6 py-28 sm:py-36">
      <Reveal>
        <p
          className="eyebrow flex items-center gap-3"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          <span className="font-mono" style={{ color: "var(--color-accent)", letterSpacing: "0.12em" }}>
            01
          </span>
          <span
            aria-hidden="true"
            className="h-px w-7"
            style={{ background: "color-mix(in srgb, var(--color-accent) 60%, transparent)" }}
          />
          Manifesto
        </p>
      </Reveal>
      <Reveal delay={120}>
        <p
          className="display mt-8 max-w-4xl text-h2 leading-[1.25] sm:text-h1 sm:leading-[1.22]"
          style={{ color: "var(--color-fg)" }}
        >
          Você não precisa de dez apps.{" "}
          <span style={{ color: "var(--color-fg-subtle)" }}>
            Precisa de{" "}
            <span className="display-i gradient-text">um sistema que te conhece</span> — e cresce
            com você, todo dia.
          </span>
        </p>
      </Reveal>
      {/* Pull-quote — o aparte editorial que arremata o manifesto, deslocado
          à direita como numa página de revista. */}
      <Reveal delay={260}>
        <blockquote
          className="mt-12 max-w-sm border-l pl-5 sm:ml-auto"
          style={{
            borderColor: "color-mix(in srgb, var(--color-accent) 45%, transparent)",
          }}
        >
          <p className="display display-i text-h3" style={{ color: "var(--color-fg-muted)" }}>
            Dez abas a menos. Um dia inteiro a mais.
          </p>
        </blockquote>
      </Reveal>
    </section>
  );
}
