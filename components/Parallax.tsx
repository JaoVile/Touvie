"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";

/**
 * Scroll-linked parallax wrapper — translates its child against the
 * scroll position so layered elements drift at their own rhythm.
 * Borrowed from obsidianassembly.com. rAF-throttled, reduced-motion
 * aware. `speed` is the multiplier on scrollY: negative drifts the
 * element up as the page scrolls down. Keep it small (|0.1–0.4|) —
 * this is depth, not movement.
 */
type Props = {
  speed?: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Parallax({ speed = -0.15, children, className, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      el.style.transform = `translate3d(0, ${window.scrollY * speed}px, 0)`;
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
  }, [speed]);

  return (
    <div ref={ref} className={className} style={{ willChange: "transform", ...style }}>
      {children}
    </div>
  );
}
