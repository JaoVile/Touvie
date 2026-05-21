"use client";

import { useEffect, useRef } from "react";

/**
 * Hairline scroll-progress bar pinned to the top edge — editorial
 * wayfinding from the obsidianassembly playbook. Driven by scroll
 * position only (no animation), rAF-throttled. Tune here.
 */
const CONFIG = {
  height: "2px",
  color: "var(--color-accent)",
} as const;

export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const ratio = max > 0 ? window.scrollY / max : 0;
      el.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50"
      style={{ height: CONFIG.height }}
    >
      <div
        ref={ref}
        className="h-full origin-left"
        style={{ background: CONFIG.color, transform: "scaleX(0)" }}
      />
    </div>
  );
}
