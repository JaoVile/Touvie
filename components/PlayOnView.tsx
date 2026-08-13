"use client";

import { type HTMLAttributes, type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Dispara animação nos DESCENDENTES quando entra na viewport — uma vez só.
 *
 * Irmão do <Reveal>: mesmo IntersectionObserver, mesmo respeito a
 * reduced-motion. A diferença é o alvo: o Reveal anima a si mesmo (entrada do
 * bloco); este marca `data-playing` e deixa o CSS animar o que está dentro.
 *
 * Existe porque as mini-telas da landing são componentes de SERVIDOR — não
 * queremos torná-las client só pra escutar scroll. Assim o custo de JS fica
 * neste invólucro fino e elas continuam estáticas.
 *
 * Toca uma vez e desconecta: é demonstração, não laço. Repetir a cada scroll
 * viraria distração.
 */
export function PlayOnView({
  children,
  className,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reduced motion: nada toca. O estado-base das mini-telas já é legível
    // (checkbox marcado, barras cheias), então não se perde informação.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlaying(true);
          io.disconnect();
        }
      },
      { threshold: 0.35, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} data-playing={playing ? "true" : undefined} {...rest}>
      {children}
    </div>
  );
}
