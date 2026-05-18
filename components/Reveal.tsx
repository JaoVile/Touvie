"use client";

import { type HTMLAttributes, type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Scroll-aware entrance: children rise + fade into place when they enter
 * the viewport — and immediately, if already in view on load. One motion
 * system for the whole app; easing comes from the `--ease-*` tokens in
 * globals.css, ported from the design guide (obsidianassembly.com).
 *
 * Tune the feel here.
 */
const CONFIG = {
  distance: 26, // px the element travels up into place
  duration: 900, // ms — deliberate, like the guide's slow reveals
  threshold: 0.12, // fraction of the element visible before it triggers
  rootMargin: "0px 0px -7% 0px", // fire a touch before it is fully on screen
} as const;

interface RevealProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Stagger delay in ms — offset siblings for a cascading reveal. */
  delay?: number;
}

export function Reveal({ children, delay = 0, className, style, ...rest }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

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

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : `translateY(${CONFIG.distance}px)`,
        transition: `opacity ${CONFIG.duration}ms var(--ease-cubic) ${delay}ms, transform ${CONFIG.duration}ms var(--ease-cubic) ${delay}ms`,
        willChange: "opacity, transform",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
