/**
 * Cursor trail colour presets. Each preset declares the four palette slots
 * the canvas needs: the ribbon body (RGB triplet — alpha is applied at
 * draw time for taper/glow), the soft glow around it, the note glyph fill
 * (solid colour) and the note glyph's surrounding bloom.
 *
 * Storage: localStorage["touvie:trailColor"] (event "touvie:trail-color").
 * Default: "white" — branca com notas pretas e bordinha branca.
 */
export type CursorColorId = "white" | "gold" | "purple" | "green" | "blue";

export interface CursorColorPreset {
  id: CursorColorId;
  name: string;
  description: string;
  /** RGB triplet — "R,G,B" — interpolated with per-segment alpha at draw time. */
  ribbonRgb: string;
  /** RGB triplet for the ribbon's bloom; usually mirrors ribbonRgb. */
  glowRgb: string;
  /** Solid colour for note glyphs (♪ ♫). */
  noteFill: string;
  /** Soft bloom around each note glyph — full rgba string. */
  noteShadow: string;
}

export const CURSOR_COLORS: CursorColorPreset[] = [
  {
    id: "white",
    name: "Branco",
    description: "Fita branca, notas brancas, bordinha preta — default.",
    ribbonRgb: "255,255,255",
    glowRgb: "255,255,255",
    noteFill: "#ffffff",
    noteShadow: "rgba(0,0,0,0.9)",
  },
  {
    id: "gold",
    name: "Gold",
    description: "Fita dourada com notas em navy — combina com Royal Navy.",
    ribbonRgb: "224,184,62",
    glowRgb: "224,184,62",
    noteFill: "#08112e",
    noteShadow: "rgba(224,184,62,0.85)",
  },
  {
    id: "purple",
    name: "Roxo",
    description: "Fita roxa, notas brancas — combina com Glass Purple.",
    ribbonRgb: "168,85,247",
    glowRgb: "168,85,247",
    noteFill: "#ffffff",
    noteShadow: "rgba(168,85,247,0.85)",
  },
  {
    id: "green",
    name: "Verde",
    description: "Fita verde, notas pretas — combina com Dark Minimal.",
    ribbonRgb: "34,197,94",
    glowRgb: "34,197,94",
    noteFill: "#0a0a0a",
    noteShadow: "rgba(34,197,94,0.85)",
  },
  {
    id: "blue",
    name: "Azul",
    description: "Fita azul-sapphire, notas douradas — combina com Notion Clean.",
    ribbonRgb: "62,91,176",
    glowRgb: "62,91,176",
    noteFill: "#e0b83e",
    noteShadow: "rgba(62,91,176,0.85)",
  },
];

export const DEFAULT_CURSOR_COLOR: CursorColorId = "white";

export const CURSOR_COLOR_KEY = "touvie:trailColor";
export const CURSOR_COLOR_EVENT = "touvie:trail-color";

export function isValidCursorColor(x: unknown): x is CursorColorId {
  return typeof x === "string" && CURSOR_COLORS.some((c) => c.id === x);
}

export function getCursorColor(id: string | null | undefined): CursorColorPreset {
  const found = CURSOR_COLORS.find((c) => c.id === id);
  // biome-ignore lint/style/noNonNullAssertion: default is always in the list
  return found ?? CURSOR_COLORS.find((c) => c.id === DEFAULT_CURSOR_COLOR)!;
}
