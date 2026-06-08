"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useState } from "react";

/**
 * Cabeçalho fixo da landing — transparente sobre o hero, vira glass com
 * hairline ao rolar. Wordmark (monograma Pinyon + Touvie) à esquerda, Entrar
 * à direita. É o "moldura" que dá acabamento premium ao conjunto.
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
    backgroundColor: scrolled ? "color-mix(in srgb, var(--color-bg) 72%, transparent)" : "transparent",
    backdropFilter: scrolled ? "blur(14px)" : "none",
    WebkitBackdropFilter: scrolled ? "blur(14px)" : "none",
    borderBottom: `1px solid ${scrolled ? "var(--color-border)" : "transparent"}`,
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 transition-all duration-500" style={style}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#top" className="flex items-center gap-2">
          <span
            aria-hidden="true"
            style={{
              fontFamily: "var(--font-pinyon), cursive",
              fontSize: "1.7rem",
              lineHeight: 1,
              color: "var(--color-accent)",
            }}
          >
            T
          </span>
          <span
            className="text-sm font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--color-fg)" }}
          >
            Touvie
          </span>
        </a>
        <Link href="/login" className="group/lnk text-sm" style={{ color: "var(--color-fg-muted)" }}>
          <span className="link-underline">Entrar</span>
        </Link>
      </div>
    </header>
  );
}
