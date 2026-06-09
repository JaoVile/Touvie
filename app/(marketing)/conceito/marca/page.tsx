import { TouvieMark } from "@/components/brand/TouvieMark";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Touvie — marca (preview)",
  description: "Preview do Monograma Celeste — a marca do Touvie.",
};

const VARIANTS = [
  { v: "nebula", name: "Nebulosa", desc: "disco cheio + estrelas + cometa — o selo" },
  { v: "ring", name: "Anel & céu", desc: "sem disco, só o anel — leve, eco do selo atual" },
  { v: "minimal", name: "Minimal", desc: "disco + T + 1 estrela — sobrevive a 16px" },
] as const;

const SIZES = [128, 64, 48, 32, 24, 16];

/** Cabeçalho editorial de seção, no mesmo idioma das outras. */
function Head({ children }: { children: string }) {
  return (
    <p className="eyebrow mb-6 flex items-center gap-3" style={{ color: "var(--color-fg-subtle)" }}>
      <span
        aria-hidden="true"
        className="h-px w-7"
        style={{ background: "color-mix(in srgb, var(--color-accent) 60%, transparent)" }}
      />
      {children}
    </p>
  );
}

export default function MarcaPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-28 pt-28">
      <p className="eyebrow" style={{ color: "var(--color-accent)" }}>
        Marca · preview
      </p>
      <h1 className="display mt-3 text-display sm:text-hero" style={{ color: "var(--color-fg)" }}>
        Monograma <span className="display-i gradient-text">Celeste</span>
      </h1>
      <p className="mt-4 max-w-xl text-base sm:text-lg" style={{ color: "var(--color-fg-muted)" }}>
        O "T" Pinyon pousado numa nebulosa navy→gold, cercado de estrelas. A imensidão e o
        "um lugar só", no mesmo emblema. Três variantes pra um sistema.
      </p>

      {/* As três variantes, grandes */}
      <section className="mt-16">
        <Head>As três variantes</Head>
        <div className="grid gap-6 sm:grid-cols-3">
          {VARIANTS.map((it) => (
            <div key={it.v} className="glass flex flex-col items-center gap-5 p-8">
              <TouvieMark size={148} variant={it.v} />
              <div className="text-center">
                <p className="display text-h3" style={{ color: "var(--color-fg)" }}>
                  {it.name}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
                  {it.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Escala — de selo a favicon */}
      <section className="mt-16">
        <Head>Escala — de selo a favicon</Head>
        <div className="glass flex flex-wrap items-end gap-8 p-10">
          {SIZES.map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <TouvieMark size={s} variant="minimal" />
              <span className="font-mono text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
                {s}px
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          A 16–24px o "T" Pinyon perde legibilidade — pra favicon a gente troca por um "T"
          serifado mais encorpado (ou só o disco + barra). É o limite esperado.
        </p>
      </section>

      {/* Lockups */}
      <section className="mt-16">
        <Head>Lockup — marca + nome</Head>
        <div className="flex flex-col gap-6">
          <div className="glass flex items-center gap-5 p-10">
            <TouvieMark size={68} variant="nebula" />
            <span className="display text-display" style={{ color: "var(--color-fg)" }}>
              Touvie
            </span>
          </div>
          <div className="glass flex items-center gap-5 p-10">
            <TouvieMark size={56} variant="minimal" />
            <span
              className="text-2xl font-semibold uppercase"
              style={{ color: "var(--color-fg)", letterSpacing: "0.22em" }}
            >
              Touvie
            </span>
          </div>
          <div className="glass flex flex-col items-center gap-4 p-12">
            <TouvieMark size={104} variant="nebula" />
            <span className="display text-display" style={{ color: "var(--color-fg)" }}>
              Touvie
            </span>
            <span className="eyebrow" style={{ color: "var(--color-fg-subtle)" }}>
              life OS pessoal
            </span>
          </div>
        </div>
      </section>

      {/* Teste de contraste sobre claro */}
      <section className="mt-16">
        <Head>Sobre fundo claro</Head>
        <div className="flex flex-wrap items-center gap-10 rounded-[1.25rem] p-12" style={{ background: "#f2e6c2" }}>
          <TouvieMark size={96} variant="nebula" />
          <TouvieMark size={96} variant="ring" />
          <TouvieMark size={64} variant="minimal" />
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          A "Nebulosa" e a "Minimal" seguram o claro (o disco navy dá contraste); a "Anel & céu"
          some — sem disco, o ouro sobre creme some. Bom saber pra usos sobre fundo claro.
        </p>
      </section>
    </main>
  );
}
