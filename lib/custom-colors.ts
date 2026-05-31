/**
 * Per-user colour overrides. Lets anyone repaint the app token by token on
 * top of whatever theme is active. Each token maps to a CSS custom property
 * the whole UI already consumes (see app/themes/*.css), so overriding it
 * cascades everywhere instantly.
 *
 * Storage: localStorage["touvie:customColors"] — a JSON map of
 *   { "--color-accent": "#e0b83e", ... }. Only the keys listed in
 * COLOR_TOKENS are ever written/applied. Applied live by ColorCustomizer and
 * before first paint by <CustomColorsBoot> (no flash).
 */
export interface ColorToken {
  /** The CSS custom property this token drives. */
  var: string;
  /** Human label shown in the panel. */
  label: string;
  /** One-liner explaining where the colour shows up. */
  hint: string;
  /**
   * "solid" — an opaque hex (the default). "alpha" — a translucent surface
   * that also exposes an opacity control and is stored as `rgba(...)`.
   */
  kind?: "solid" | "alpha";
}

/**
 * The site's full palette — every colour that paints the UI. Solid tokens are
 * edited as an opaque hex; "alpha" tokens (cards, borders) add an opacity
 * slider and persist as `rgba(...)`, so translucent surfaces stay adjustable
 * without losing the glass look.
 */
export const COLOR_TOKENS: ColorToken[] = [
  { var: "--color-bg", label: "Fundo", hint: "A cor base de toda a tela." },
  { var: "--color-bg-elevated", label: "Fundo elevado", hint: "Camadas acima do fundo." },
  { var: "--color-card", label: "Cards", hint: "Superfície dos blocos.", kind: "alpha" },
  {
    var: "--color-border",
    label: "Bordas",
    hint: "Linhas, contornos e divisórias.",
    kind: "alpha",
  },
  { var: "--color-fg", label: "Texto", hint: "Cor principal do texto." },
  { var: "--color-fg-muted", label: "Texto suave", hint: "Descrições, legendas e subtítulos." },
  { var: "--color-fg-subtle", label: "Texto sutil", hint: "Detalhes discretos e placeholders." },
  { var: "--color-accent", label: "Acento", hint: "Destaque principal — botões, links e foco." },
  { var: "--color-accent-2", label: "Acento 2", hint: "Destaque secundário e gradientes." },
  { var: "--color-glyph", label: "Desenhos", hint: "Glifos decorativos do fundo." },
  { var: "--color-success", label: "Sucesso", hint: "Confirmações e valores positivos." },
  { var: "--color-danger", label: "Erro", hint: "Alertas, exclusões e valores negativos." },
];

export type CustomColors = Record<string, string>;

export const CUSTOM_COLORS_KEY = "touvie:customColors";
export const CUSTOM_COLORS_EVENT = "touvie:custom-colors";

const VALID_VARS = new Set(COLOR_TOKENS.map((t) => t.var));

/** Keep only known tokens with a plausible colour value. */
export function sanitizeCustomColors(input: unknown): CustomColors {
  if (!input || typeof input !== "object") return {};
  const out: CustomColors = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (VALID_VARS.has(k) && typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

export function readCustomColors(): CustomColors {
  if (typeof window === "undefined") return {};
  try {
    return sanitizeCustomColors(JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY) ?? "{}"));
  } catch {
    return {};
  }
}

/**
 * Apply (or clear) the overrides onto an element's inline style. Any token
 * not present in `map` is removed so it falls back to the theme value. Two
 * gradients are re-derived from the effective tokens so edits actually show:
 * --gradient-brand from the accents (buttons/headings) and --gradient-bg from
 * the bg tokens (the visible page background, which never reads --color-bg).
 */
export function applyCustomColors(
  map: CustomColors,
  root: HTMLElement = document.documentElement,
): void {
  for (const token of COLOR_TOKENS) {
    const value = map[token.var];
    if (value) root.style.setProperty(token.var, value);
    else root.style.removeProperty(token.var);
  }

  const cs = getComputedStyle(root);

  // The brand gradient (buttons, headings) is re-derived from the accents so
  // an accent edit recolours it too.
  if (map["--color-accent"] || map["--color-accent-2"]) {
    const a1 = (map["--color-accent"] || cs.getPropertyValue("--color-accent")).trim();
    const a2 = (map["--color-accent-2"] || cs.getPropertyValue("--color-accent-2")).trim();
    root.style.setProperty("--gradient-brand", `linear-gradient(135deg, ${a1} 0%, ${a2} 100%)`);
  } else {
    root.style.removeProperty("--gradient-brand");
  }

  // The visible page background is --gradient-bg, NOT --color-bg directly — so
  // a "Fundo" edit only shows up if we rebuild the gradient from the bg tokens.
  if (map["--color-bg"] || map["--color-bg-elevated"]) {
    const bg = (map["--color-bg"] || cs.getPropertyValue("--color-bg")).trim();
    const bgEl = (map["--color-bg-elevated"] || cs.getPropertyValue("--color-bg-elevated")).trim();
    root.style.setProperty(
      "--gradient-bg",
      `radial-gradient(ellipse at top, ${bgEl} 0%, ${bg} 55%)`,
    );
  } else {
    root.style.removeProperty("--gradient-bg");
  }
}

export function saveCustomColors(map: CustomColors): void {
  if (typeof window === "undefined") return;
  const clean = sanitizeCustomColors(map);
  if (Object.keys(clean).length === 0) localStorage.removeItem(CUSTOM_COLORS_KEY);
  else localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(clean));
  window.dispatchEvent(new CustomEvent(CUSTOM_COLORS_EVENT, { detail: clean }));
}
