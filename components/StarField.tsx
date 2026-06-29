"use client";

import { QUALITY_EVENT, type QualityTier, readQuality } from "@/lib/quality";
import { type CSSProperties, useEffect, useRef, useState } from "react";

/**
 * Atmosfera celeste do Touvie — um céu de estrelas tênues que cintilam e
 * derivam de leve com o scroll (parallax de profundidade, não de movimento),
 * ecoando o "Monograma Celeste" e as estrelinhas do emblema. Nasceu na landing
 * e virou assinatura do app inteiro (mora no root layout, como o CursorTrail).
 *
 * Liga/desliga pelo /config (card "Tema visual") — preferência por navegador
 * via localStorage `touvie:stars`, refletida AO VIVO pelo evento `touvie:stars`
 * (sem reload). Default LIGADO.
 *
 * Posições DETERMINÍSTICAS (por índice, via trig — nada de random) pra não dar
 * mismatch de hidratação. Fixed atrás de tudo, decorativo, pointer-events:none.
 * O cintilar respeita reduced-motion (classe `.star` no globals.css).
 */
export const STARS_STORAGE_KEY = "touvie:stars";
export const STARS_EVENT = "touvie:stars";

type Star = {
  left: string;
  top: string;
  size: number;
  delay: string;
  dur: string;
  bright: boolean;
};

// 60 estrelas espalhadas por índice — puro, avaliado uma vez no módulo.
const STARS: Star[] = Array.from({ length: 60 }, (_, i) => ({
  left: `${((i * 97.13) % 100).toFixed(2)}%`,
  top: `${((i * 41.7 + (i % 5) * 13.3) % 100).toFixed(2)}%`,
  size: 1 + (i % 3), // 1–3px
  delay: `${((i % 8) * 0.7).toFixed(2)}s`,
  dur: `${3 + (i % 5)}s`,
  bright: i % 9 === 0, // ~1 em 9 puxa o dourado e brilha mais
}));

export function StarField() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(true); // default ligado; reconciliado no mount
  // Nível de qualidade — as estrelas só aparecem em "completo".
  const [quality, setQuality] = useState<QualityTier>("completo");

  // Lê a preferência salva e reflete o toggle ao vivo (sem reload).
  useEffect(() => {
    const read = () => localStorage.getItem(STARS_STORAGE_KEY) !== "off";
    setOn(read());
    setQuality(readQuality());
    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setOn(typeof detail === "boolean" ? detail : read());
    };
    const onQuality = (e: Event) => {
      const v = (e as CustomEvent).detail;
      setQuality(v === "completo" || v === "desempenho" ? v : readQuality());
    };
    window.addEventListener(STARS_EVENT, onToggle);
    window.addEventListener(QUALITY_EVENT, onQuality);
    return () => {
      window.removeEventListener(STARS_EVENT, onToggle);
      window.removeEventListener(QUALITY_EVENT, onQuality);
    };
  }, []);

  // Parallax de profundidade, clampado pra nunca revelar a borda do céu.
  useEffect(() => {
    if (!on || quality !== "completo") return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = Math.max(-80, window.scrollY * -0.03);
        el.style.transform = `translateY(${y}px)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [on, quality]);

  if (!on || quality !== "completo") return null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed -top-[15%] left-0 -z-10 h-[130%] w-full overflow-hidden"
    >
      {STARS.map((s) => (
        <span
          key={`${s.left}-${s.top}`}
          className="star"
          style={
            {
              left: s.left,
              top: s.top,
              width: `${s.size}px`,
              height: `${s.size}px`,
              "--star-delay": s.delay,
              "--star-dur": s.dur,
              "--star-peak": s.bright ? "0.95" : "0.6",
              background: s.bright ? "var(--color-accent)" : "var(--color-fg)",
              boxShadow: s.bright
                ? "0 0 7px var(--color-accent)"
                : "0 0 3px color-mix(in srgb, var(--color-fg) 55%, transparent)",
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
