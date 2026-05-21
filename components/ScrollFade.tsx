"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * Section hand-off: as the wrapped block scrolls up out of view it
 * recedes — fading, shrinking and drifting up — so the next section
 * takes the stage. Scroll-linked (reversible), rAF-throttled,
 * reduced-motion aware. obsidianassembly-style. Tune here.
 */
const CONFIG = {
  range: 380, // px of scroll over which the block fully recedes
  minOpacity: 0.2,
  minScale: 0.95,
  lift: 44, // px of upward drift across the range
} as const;

export function ScrollFade({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / CONFIG.range));
      const opacity = 1 - p * (1 - CONFIG.minOpacity);
      const scale = 1 - p * (1 - CONFIG.minScale);
      el.style.opacity = String(opacity);
      el.style.transform = `translate3d(0, ${-p * CONFIG.lift}px, 0) scale(${scale})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} style={{ willChange: "opacity, transform" }}>
      {children}
    </div>
  );
}
