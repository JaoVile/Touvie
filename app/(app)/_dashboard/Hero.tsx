import { CircleText } from "@/components/CircleText";
import { Parallax } from "@/components/Parallax";
import { Reveal } from "@/components/Reveal";
import { ScrollFade } from "@/components/ScrollFade";
import { formatDateBRT, greetingForHour } from "@/lib/datetime";
import type { ReactNode } from "react";

/* Faint editorial glyphs drifting behind the dashboard, each at its
   own scroll rhythm. Tune size / position / opacity / speed here. */
const PARALLAX_GLYPHS = [
  {
    char: "✦",
    size: "18rem",
    top: "20%",
    left: "6%",
    speed: -0.18,
    opacity: 0.05,
    color: "var(--color-accent)",
  },
  {
    char: "♪",
    size: "12rem",
    top: "54%",
    left: "80%",
    speed: -0.34,
    opacity: 0.05,
    color: "var(--color-fg)",
  },
  {
    char: "♫",
    size: "15rem",
    top: "82%",
    left: "36%",
    speed: -0.09,
    opacity: 0.04,
    color: "var(--color-accent)",
  },
] as const;

/* Hero composition — a small greeting arc crowning the visible NAME
   (not the ghost wordmark), with the "Touvie" ghost watermarked below,
   floating just above the date row's golden hairlines. */
const HERO_CONFIG = {
  wordmarkFontSize: "9rem",
  wordmarkOpacity: 0.07,
  wordmarkBottom: "-0.5rem",
  wordmarkOffsetX: "-5%",
  wordmarkParallaxSpeed: -0.06,

  arcRadius: 65,
  arcStartOffset: 0.5,
  arcFontSize: 12,
  arcLetterSpacing: "0.3em",
  arcOffsetX: "28%",
  arcTranslateY: "1.5rem",
  arcRotate: 32,

  nameSize: "text-[3.25rem] sm:text-[4.75rem]",
} as const;

type Stat = { label: string; node: ReactNode; color: string };

export function Hero({ heroName, stats, now }: { heroName: string; stats: Stat[]; now: Date }) {
  return (
    <>
      {/* ── Parallax depth layer — faint glyphs drifting on scroll ── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {PARALLAX_GLYPHS.map((g) => (
          <Parallax
            key={g.char}
            speed={g.speed}
            className="absolute"
            style={{ top: g.top, left: g.left }}
          >
            <span
              className="block select-none leading-none"
              style={{ fontSize: g.size, color: g.color, opacity: g.opacity }}
            >
              {g.char}
            </span>
          </Parallax>
        ))}
      </div>

      <ScrollFade>
        <Reveal>
          <header className="relative mb-16 flex flex-col items-center pb-10 pt-16 text-center">
            <div className="relative inline-block">
              <CircleText
                text={`· ${greetingForHour().toUpperCase()} ·`}
                radius={HERO_CONFIG.arcRadius}
                arc="top"
                startOffset={HERO_CONFIG.arcStartOffset}
                textAnchor="middle"
                fontSize={HERO_CONFIG.arcFontSize}
                letterSpacing={HERO_CONFIG.arcLetterSpacing}
                style={{
                  color: "var(--color-accent)",
                  position: "absolute",
                  bottom: "100%",
                  left: "50%",
                  transform: `translate(calc(-50% + ${HERO_CONFIG.arcOffsetX}), ${HERO_CONFIG.arcTranslateY}) rotate(${HERO_CONFIG.arcRotate}deg)`,
                  pointerEvents: "none",
                }}
              />
              <h1 className={`display relative leading-[1.05] ${HERO_CONFIG.nameSize}`}>
                <span className="display-i gradient-text-anim">{heroName}</span>
              </h1>
            </div>

            <div className="relative mt-3 flex items-center gap-3">
              <div
                className="pointer-events-none absolute left-1/2"
                style={{
                  bottom: HERO_CONFIG.wordmarkBottom,
                  transform: `translateX(calc(-50% + ${HERO_CONFIG.wordmarkOffsetX}))`,
                }}
              >
                <Parallax speed={HERO_CONFIG.wordmarkParallaxSpeed}>
                  <span
                    aria-hidden
                    className="block select-none whitespace-nowrap leading-none"
                    style={{
                      fontFamily: "var(--font-pinyon), cursive",
                      fontSize: HERO_CONFIG.wordmarkFontSize,
                      color: "var(--color-accent)",
                      opacity: HERO_CONFIG.wordmarkOpacity,
                    }}
                  >
                    Touvie
                  </span>
                </Parallax>
              </div>
              <span className="h-px w-10" style={{ background: "var(--color-border)" }} />
              <p
                className="text-sm first-letter:uppercase"
                style={{ color: "var(--color-fg-muted)" }}
              >
                {formatDateBRT(now)}
              </p>
              <span className="h-px w-10" style={{ background: "var(--color-border)" }} />
            </div>

            <dl className="glass mt-10 flex w-full overflow-hidden">
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  className="flex-1 px-4 py-3.5 sm:px-6"
                  style={i > 0 ? { borderLeft: "1px solid var(--color-border)" } : undefined}
                >
                  <dt
                    className="text-eyebrow font-semibold uppercase tracking-[0.13em]"
                    style={{ color: "var(--color-fg-subtle)" }}
                  >
                    {s.label}
                  </dt>
                  <dd
                    className="mt-1 font-mono text-lg font-semibold leading-none sm:text-xl"
                    style={{ color: s.color }}
                  >
                    {s.node}
                  </dd>
                </div>
              ))}
            </dl>
          </header>
        </Reveal>
      </ScrollFade>
    </>
  );
}
