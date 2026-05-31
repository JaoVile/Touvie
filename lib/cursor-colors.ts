/**
 * Cursor trail colour presets. Each preset declares the four palette slots
 * the canvas needs: the ribbon body (RGB triplet — alpha is applied at
 * draw time for taper/glow), the soft glow around it, the note glyph fill
 * (solid colour) and the note glyph's surrounding bloom.
 *
 * Storage: localStorage["touvie:trailColor"] (event "touvie:trail-color").
 * The special "custom" id ("Personalizar") reads its ribbon/note colours from
 * localStorage["touvie:trailCustom"] (event "touvie:trail-custom").
 * Default: "blue".
 */
export type CursorColorId = "blue" | "purple" | "green" | "custom";

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
  /** Optional crisp outline drawn around each note glyph (hex). */
  noteOutline?: string;
  /** Bloom radius around the notes, in px (defaults to a subtle 5). */
  glowBlur?: number;
}

export const CURSOR_COLORS: CursorColorPreset[] = [
  {
    id: "blue",
    name: "Azul",
    description: "Fita azul-sapphire, notas douradas — combina com Royal Navy.",
    ribbonRgb: "62,91,176",
    glowRgb: "62,91,176",
    noteFill: "#e0b83e",
    noteShadow: "rgba(62,91,176,0.85)",
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
];

export const DEFAULT_CURSOR_COLOR: CursorColorId = "blue";

export const CURSOR_COLOR_KEY = "touvie:trailColor";
export const CURSOR_COLOR_EVENT = "touvie:trail-color";

/** The build-your-own ribbon colour. */
export const CUSTOM_CURSOR_ID = "custom" as const;
export const CURSOR_CUSTOM_KEY = "touvie:trailCustom";
export const CURSOR_CUSTOM_EVENT = "touvie:trail-custom";

export interface CustomCursor {
  /** Ribbon body colour, hex. */
  ribbon: string;
  /** Note glyph colour, hex. */
  note: string;
  /** Optional outline around the notes (hex). Empty/absent = no outline. */
  outline?: string;
  /** Note bloom radius in px (extra detail). Absent = the default 5. */
  glow?: number;
}

/** Default note bloom radius (px) when "glow" isn't customised. */
export const DEFAULT_GLOW = 5;

/** Defaults to the old gold ribbon so "Personalizar" starts on the navy+gold look. */
export const DEFAULT_CUSTOM_CURSOR: CustomCursor = { ribbon: "#e0b83e", note: "#08112e" };

function hexToTriplet(hex: string): string {
  let h = (hex || "").trim().replace(/^#/, "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return "224,184,62"; // fall back to gold
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ].join(",");
}

/** Build a canvas palette from the user's chosen ribbon + note colours. */
export function buildCursorPreset(custom: CustomCursor): CursorColorPreset {
  const triplet = hexToTriplet(custom.ribbon);
  return {
    id: CUSTOM_CURSOR_ID,
    name: "Personalizar",
    description: "Suas cores de fita e de notas.",
    ribbonRgb: triplet,
    glowRgb: triplet,
    noteFill: custom.note,
    noteShadow: `rgba(${triplet},0.85)`,
    noteOutline: custom.outline?.trim() ? custom.outline.trim() : undefined,
    glowBlur: typeof custom.glow === "number" ? custom.glow : undefined,
  };
}

export function readCustomCursor(): CustomCursor {
  if (typeof window === "undefined") return DEFAULT_CUSTOM_CURSOR;
  try {
    const raw = JSON.parse(window.localStorage.getItem(CURSOR_CUSTOM_KEY) ?? "{}");
    return {
      ribbon: typeof raw?.ribbon === "string" ? raw.ribbon : DEFAULT_CUSTOM_CURSOR.ribbon,
      note: typeof raw?.note === "string" ? raw.note : DEFAULT_CUSTOM_CURSOR.note,
      outline: typeof raw?.outline === "string" ? raw.outline : undefined,
      glow: typeof raw?.glow === "number" ? raw.glow : undefined,
    };
  } catch {
    return DEFAULT_CUSTOM_CURSOR;
  }
}

export function saveCustomCursor(custom: CustomCursor): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CURSOR_CUSTOM_KEY, JSON.stringify(custom));
  window.dispatchEvent(new CustomEvent(CURSOR_CUSTOM_EVENT, { detail: custom }));
}

export function isValidCursorColor(x: unknown): x is CursorColorId {
  return x === CUSTOM_CURSOR_ID || (typeof x === "string" && CURSOR_COLORS.some((c) => c.id === x));
}

export function getCursorColor(id: string | null | undefined): CursorColorPreset {
  if (id === CUSTOM_CURSOR_ID) return buildCursorPreset(readCustomCursor());
  const found = CURSOR_COLORS.find((c) => c.id === id);
  return found ?? CURSOR_COLORS.find((c) => c.id === DEFAULT_CURSOR_COLOR) ?? CURSOR_COLORS[0];
}
