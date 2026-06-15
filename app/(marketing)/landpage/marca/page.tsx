import { TouvieEmblem } from "@/components/brand/TouvieEmblem";
import { TouvieLogo } from "@/components/brand/TouvieLogo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Touvie — marca (preview)",
  description: "Preview do Monograma Celeste — a marca do Touvie.",
  // Showcase interno da marca — público pra visualizar, mas fora do índice.
  robots: { index: false, follow: false },
};

const EMBLEM_SIZES = [120, 64, 48, 32, 24, 16];

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
        O "T" caligráfico varrido por uma órbita-cometa, com estrelas, notas musicais e a clave de
        sol na ponta — a imensidão e o "um lugar só", no mesmo emblema.
      </p>

      {/* A marca viva — destaque animado (arte real) */}
      <section
        className="mt-14 flex flex-col items-center gap-7 rounded-[1.5rem] py-14"
        style={{
          background:
            "radial-gradient(ellipse at center, color-mix(in srgb, var(--color-accent) 7%, transparent), transparent 70%)",
        }}
      >
        <TouvieEmblem size={300} alt="" />
        <p className="max-w-sm text-center text-sm" style={{ color: "var(--color-fg-muted)" }}>
          A marca <span className="display-i gradient-text">viva</span> — a auréola gira em órbita
          com a fagulha na ponta, as estrelas respiram e brilham, a clave pende e as notinhas
          dançam. Tudo em CSS, respeitando quem prefere menos movimento.
        </p>
      </section>

      {/* Lockup — marca + nome / só emblema */}
      <section className="mt-16">
        <Head>Lockup &amp; emblema</Head>
        <div className="glass flex flex-col items-center gap-10 p-12 sm:flex-row sm:justify-around">
          <TouvieLogo size={200} />
          <TouvieLogo emblem size={120} alt="" />
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          À esquerda o lockup completo (emblema + "Touvie"); à direita só o emblema — header, ícone,
          favicon.
        </p>
      </section>

      {/* Escala — de selo a favicon */}
      <section className="mt-16">
        <Head>Escala — de selo a favicon</Head>
        <div className="glass flex flex-wrap items-end gap-8 p-10">
          {EMBLEM_SIZES.map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <TouvieLogo emblem size={s} alt="" />
              <span className="font-mono text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
                {s}px
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          Pro favicon (aba) usamos <code>touvie-icon.svg</code> — o emblema transparente em recorte
          quadrado; os PNGs do PWA ganham o fundo navy da arte.
        </p>
      </section>

      {/* Sobre fundo claro */}
      <section className="mt-16">
        <Head>Sobre fundo claro</Head>
        <div
          className="flex flex-wrap items-center gap-10 rounded-[1.25rem] p-12"
          style={{ background: "#f2e6c2" }}
        >
          <TouvieLogo size={160} />
          <TouvieLogo emblem size={96} alt="" />
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          O ouro segura sobre o creme; pra fundos claros muito chapados, prefira a versão em disco
          navy.
        </p>
      </section>

      {/* Arquivos */}
      <section className="mt-16">
        <Head>Arquivos</Head>
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-fg-muted)" }}>
          Masters vetoriais em <code>public/brand/</code>: <code>touvie-logo.svg</code> (com fundo),{" "}
          <code>touvie-logo-alt.svg</code> (transparente), <code>touvie-mark.svg</code> (só
          emblema), <code>touvie-mark-bg.svg</code> (emblema com fundo) e{" "}
          <code>touvie-icon.svg</code> (recorte quadrado pro favicon). Ficha técnica no README da
          pasta.
        </p>
      </section>
    </main>
  );
}
