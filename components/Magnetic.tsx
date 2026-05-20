"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

/**
 * Magnetic hover wrapper — pulls the wrapped element toward the cursor when
 * the pointer enters a proximity radius around its center. Mirrors the
 * obsidianassembly.com signature behaviour on CTAs.
 *
 * Tuning (defaults match the reference feel):
 *   - strength    0..1, fraction of the offset the element follows (0.4)
 *   - radius      px, proximity zone around the element center (80)
 *   - ease        0..1, per-frame interpolation toward target (0.18 = ~snappy
 *                 settle; lower for floatier, higher for stiffer)
 *
 * Disabled on coarse pointers and under prefers-reduced-motion (no cursor to
 * track / motion-averse user). Cleaned up on unmount.
 */
export interface MagneticProps {
  children: ReactNode;
  strength?: number;
  radius?: number;
  ease?: number;
  className?: string;
  /** When true, the wrapper renders as block; default is inline-block. */
  block?: boolean;
}

export function Magnetic({
  children,
  strength = 0.4,
  radius = 80,
  ease = 0.18,
  className,
  block = false,
}: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Bail on touch / motion-averse — there is no hovering cursor to follow.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let tx = 0;
    let ty = 0;
    let targetX = 0;
    let targetY = 0;
    let raf = 0;

    const tick = () => {
      tx += (targetX - tx) * ease;
      ty += (targetY - ty) * ease;
      el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
      // Stop the rAF loop once we've effectively reached the target — saves
      // power while the user is idle elsewhere on the page.
      const settled = Math.abs(targetX - tx) < 0.05 && Math.abs(targetY - ty) < 0.05;
      raf = settled ? 0 : requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);

      if (dist < radius) {
        // Falloff toward the edge of the radius so it feels gravitational,
        // not abrupt — full strength at center, fading to 0 at the rim.
        const falloff = 1 - dist / radius;
        targetX = dx * strength * falloff;
        targetY = dy * strength * falloff;
      } else {
        targetX = 0;
        targetY = 0;
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, [strength, radius, ease]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ display: block ? "block" : "inline-block", willChange: "transform" }}
    >
      {children}
    </div>
  );
}
