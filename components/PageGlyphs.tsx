"use client";

import { Parallax } from "./Parallax";

/**
 * Faint editorial glyphs drifting behind a page, each at its own scroll
 * rhythm — the depth layer borrowed from obsidianassembly.com. Lifted
 * out of the dashboard so every internal page can share it.
 *
 * Each page renders its OWN <PageGlyphs> (it is not in the shared
 * layout) so the glyphs can be themed per section. reduced-motion is
 * handled inside <Parallax>.
 */

export type Glyph = {
  char: string; // typographic glyph — inherits `color`, so NOT an emoji
  size: string; // font-size, e.g. "16rem"
  top: string; // % from top
  left: string; // % from left
  speed: number; // parallax multiplier — keep |0.08–0.36| (depth, not motion)
  opacity: number; // keep ~0.04–0.06 so it reads as texture, not content
  color?: string; // defaults to ACCENT below
};

/* ── Tune here ─────────────────────────────────────────────────────
   One 3-glyph composition per section. char / size / position /
   speed / opacity are all tunable. */
const ACCENT = "var(--color-accent)";
const FG = "var(--color-fg)";

export const GLYPH_PRESETS = {
  goals: [
    { char: "✦", size: "18rem", top: "18%", left: "7%", speed: -0.18, opacity: 0.05 },
    { char: "↗", size: "13rem", top: "56%", left: "82%", speed: -0.32, opacity: 0.05, color: FG },
    { char: "◆", size: "11rem", top: "84%", left: "30%", speed: -0.1, opacity: 0.04 },
  ],
  editorial: [
    { char: "¶", size: "16rem", top: "16%", left: "78%", speed: -0.2, opacity: 0.05 },
    { char: "✦", size: "12rem", top: "52%", left: "8%", speed: -0.34, opacity: 0.05, color: FG },
    { char: "❞", size: "15rem", top: "82%", left: "60%", speed: -0.1, opacity: 0.04 },
  ],
  system: [
    { char: "✦", size: "17rem", top: "20%", left: "80%", speed: -0.16, opacity: 0.05 },
    { char: "◇", size: "12rem", top: "58%", left: "6%", speed: -0.3, opacity: 0.05, color: FG },
    { char: "+", size: "13rem", top: "85%", left: "44%", speed: -0.09, opacity: 0.04 },
  ],
  routine: [
    { char: "✦", size: "18rem", top: "17%", left: "9%", speed: -0.18, opacity: 0.05 },
    { char: "⟳", size: "13rem", top: "55%", left: "81%", speed: -0.32, opacity: 0.05, color: FG },
    { char: "◆", size: "11rem", top: "84%", left: "34%", speed: -0.1, opacity: 0.04 },
  ],
  diet: [
    { char: "✦", size: "17rem", top: "19%", left: "77%", speed: -0.17, opacity: 0.05 },
    { char: "❉", size: "12rem", top: "54%", left: "7%", speed: -0.31, opacity: 0.05, color: FG },
    { char: "◆", size: "12rem", top: "84%", left: "48%", speed: -0.1, opacity: 0.04 },
  ],
  finance: [
    { char: "✦", size: "18rem", top: "18%", left: "8%", speed: -0.18, opacity: 0.05 },
    { char: "$", size: "12rem", top: "56%", left: "82%", speed: -0.32, opacity: 0.05, color: FG },
    { char: "◆", size: "11rem", top: "84%", left: "32%", speed: -0.1, opacity: 0.04 },
  ],
  fitness: [
    { char: "✦", size: "17rem", top: "20%", left: "79%", speed: -0.17, opacity: 0.05 },
    { char: "▲", size: "11rem", top: "55%", left: "7%", speed: -0.3, opacity: 0.05, color: FG },
    { char: "◆", size: "12rem", top: "84%", left: "46%", speed: -0.1, opacity: 0.04 },
  ],
} satisfies Record<string, Glyph[]>;

export type GlyphVariant = keyof typeof GLYPH_PRESETS;

type Props = {
  /** Named preset composition. Ignored when `glyphs` is passed. */
  variant?: GlyphVariant;
  /** Custom glyph composition — overrides `variant`. */
  glyphs?: Glyph[];
};

export function PageGlyphs({ variant = "goals", glyphs }: Props) {
  const list = glyphs ?? GLYPH_PRESETS[variant];

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {list.map((g, i) => (
        <Parallax
          key={`${g.char}-${i}`}
          speed={g.speed}
          className="absolute"
          style={{ top: g.top, left: g.left }}
        >
          <span
            className="block select-none leading-none"
            style={{
              fontSize: g.size,
              // Customisable via --color-glyph (the "Desenhos" token); when
              // unset, falls back to each glyph's designed accent/fg colour.
              color: `var(--color-glyph, ${g.color ?? ACCENT})`,
              opacity: g.opacity,
            }}
          >
            {g.char}
          </span>
        </Parallax>
      ))}
    </div>
  );
}
