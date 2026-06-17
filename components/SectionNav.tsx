"use client";

import { useEffect, useState } from "react";

/**
 * Navegador de seções — régua VERTICAL no canto inferior direito (só desktop):
 * um tracinho por seção, empilhados de cima (Início) a baixo (Começar). O da
 * seção visível acende em dourado e cresce; passar o mouse revela o rótulo à
 * esquerda; clicar rola suave até ela. Cada item tem área de clique generosa
 * (padding), bem além do fio. Scroll-spy por IntersectionObserver numa faixa
 * central da viewport. Respeita reduced-motion (rolagem sem easing).
 */
const SECTIONS: { id: string; label: string }[] = [
  { id: "inicio", label: "Início" },
  { id: "manifesto", label: "Manifesto" },
  { id: "antes-depois", label: "Antes & depois" },
  { id: "modulos", label: "Módulos" },
  { id: "um-dia", label: "Um dia" },
  { id: "diferenciais", label: "Diferenciais" },
  { id: "numeros", label: "Números" },
  { id: "faq", label: "FAQ" },
  { id: "cta", label: "Começar" },
];

export function SectionNav() {
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    // Acende a seção que cruza a faixa central (40%–50%) da viewport.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  function go(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  return (
    <nav
      aria-label="Seções"
      className="fixed right-5 bottom-8 z-30 hidden flex-col items-end lg:flex"
    >
      {SECTIONS.map((s) => {
        const on = active === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => go(s.id)}
            aria-label={s.label}
            aria-current={on ? "true" : undefined}
            className="group/sn relative flex items-center py-2 pr-1 pl-8"
          >
            <span
              className="pointer-events-none absolute right-full mr-1 whitespace-nowrap text-[11px] uppercase tracking-[0.14em] opacity-0 transition-opacity duration-300 group-hover/sn:opacity-100"
              style={{ color: "var(--color-fg-muted)" }}
            >
              {s.label}
            </span>
            <span
              className={`block h-0.5 rounded-full transition-all duration-300 ${
                on
                  ? "w-8 opacity-100"
                  : "w-3.5 opacity-55 group-hover/sn:w-6 group-hover/sn:opacity-100"
              }`}
              style={{ background: on ? "var(--color-accent)" : "var(--color-fg-muted)" }}
            />
          </button>
        );
      })}
    </nav>
  );
}
