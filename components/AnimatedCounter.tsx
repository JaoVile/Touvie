"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

/**
 * Editorial counter that climbs from zero to `to` once it enters the
 * viewport — borrowed from the obsidianassembly.com playbook. Tune here.
 */
const CONFIG = {
  duration: 1400, // ms — slow enough to be felt, fast enough to not annoy
  threshold: 0.4,
  rootMargin: "0px 0px -10% 0px",
} as const;

type Props = {
  to: number;
  /** Override duration in ms. */
  duration?: number;
  /** Wait before starting (lets siblings stagger). */
  delay?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  /** Treat `to` as BRL cents and format with Intl currency. */
  currency?: boolean;
  className?: string;
  style?: CSSProperties;
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function render(value: number, { prefix, suffix, decimals = 0, currency }: Props): string {
  if (currency) return brl.format(value / 100);
  const fixed = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
  return `${prefix ?? ""}${fixed}${suffix ?? ""}`;
}

export function AnimatedCounter(props: Props) {
  const { to, duration = CONFIG.duration, delay = 0, className, style } = props;
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion: snap to the final value, skip the climb.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }

    let raf = 0;
    let start: number | null = null;
    const animate = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      // Ease-out cubic — fast then settles, mirrors the reveal cadence.
      const eased = 1 - (1 - p) ** 3;
      setValue(to * eased);
      if (p < 1) raf = requestAnimationFrame(animate);
    };

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          io.disconnect();
          timeout = setTimeout(() => {
            raf = requestAnimationFrame(animate);
          }, delay);
        }
      },
      { threshold: CONFIG.threshold, rootMargin: CONFIG.rootMargin },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      if (timeout) clearTimeout(timeout);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [to, duration, delay]);

  return (
    <span ref={ref} className={className} style={style}>
      {render(value, props)}
    </span>
  );
}
