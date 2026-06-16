"use client";

import {
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * Scroll-aware entrance: children rise + fade into place when they enter
 * the viewport — and immediately, if already in view on load. One motion
 * system for the whole app; easing comes from the `--ease-*` tokens in
 * globals.css, ported from the design guide (obsidianassembly.com).
 *
 * `from` escolhe a DIREÇÃO da entrada (default "up" = o fade+rise clássico,
 * então tudo que já usa <Reveal> continua idêntico). "left"/"right" deslizam
 * lateral (ótimo pra colunas espelhadas), "scale" surge crescendo (marca,
 * selos), "down" desce. `amount` sobrescreve a distância da viagem.
 *
 * Tune the feel here.
 */
const CONFIG = {
  distance: 26, // px the element travels into place
  duration: 900, // ms — deliberate, like the guide's slow reveals
  threshold: 0.12, // fraction of the element visible before it triggers
  rootMargin: "0px 0px -7% 0px", // fire a touch before it is fully on screen
} as const;

type RevealFrom = "up" | "down" | "left" | "right" | "scale";

const hiddenTransform = (from: RevealFrom, d: number): string => {
  switch (from) {
    case "down":
      return `translateY(${-d}px)`;
    case "left":
      return `translateX(${-d}px)`;
    case "right":
      return `translateX(${d}px)`;
    case "scale":
      return `translateY(${d * 0.4}px) scale(0.93)`;
    default:
      return `translateY(${d}px)`; // up
  }
};

interface RevealProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Stagger delay in ms — offset siblings for a cascading reveal. */
  delay?: number;
  /** Direção/estilo de entrada. Default "up" (o fade+rise clássico). */
  from?: RevealFrom;
  /** Distância da viagem em px (sobrescreve o default 26). */
  amount?: number;
}

export function Reveal({
  children,
  delay = 0,
  from = "up",
  amount,
  className,
  style,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const distance = amount ?? CONFIG.distance;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reduced motion: skip the travel, just be present.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: CONFIG.threshold, rootMargin: CONFIG.rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const transition: CSSProperties = {
    opacity: shown ? 1 : 0,
    transform: shown ? "none" : hiddenTransform(from, distance),
    transition: `opacity ${CONFIG.duration}ms var(--ease-cubic) ${delay}ms, transform ${CONFIG.duration}ms var(--ease-cubic) ${delay}ms`,
    willChange: "opacity, transform",
    ...style,
  };

  return (
    <div ref={ref} className={className} style={transition} {...rest}>
      {children}
    </div>
  );
}
