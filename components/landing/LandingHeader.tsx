"use client";

import { Magnetic } from "@/components/Magnetic";
import Link from "next/link";
import { type CSSProperties, useEffect, useState } from "react";

/**
 * Cabeçalho FIXO da landing — sempre presente no topo (como na versão
 * original). Transparente sobre o hero, vira glass com hairline ao rolar.
 * Wordmark à esquerda; botão Entrar (pill de CONTORNO dourado magnético —
 * secundário de propósito, pra o pill sólido do hero seguir como o único
 * CTA primário) à direita.
 */
export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const style: CSSProperties = {
    backgroundColor: scrolled
      ? "color-mix(in srgb, var(--color-bg) 72%, transparent)"
      : "transparent",
    backdropFilter: scrolled ? "blur(14px)" : "none",
    WebkitBackdropFilter: scrolled ? "blur(14px)" : "none",
    borderBottom: `1px solid ${scrolled ? "var(--color-border)" : "transparent"}`,
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 transition-all duration-500" style={style}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2.5">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Touvie — voltar ao topo"
          className="flex items-center"
        >
          <span
            className="text-base font-semibold uppercase tracking-[0.24em]"
            style={{ color: "var(--color-fg)" }}
          >
            Touvie
          </span>
        </button>
        <Magnetic strength={0.4} radius={80}>
          <Link
            href="/login"
            className="btn-pill-ghost inline-flex items-center rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            Entrar
          </Link>
        </Magnetic>
      </div>
    </header>
  );
}
