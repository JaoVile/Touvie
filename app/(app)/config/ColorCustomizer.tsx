"use client";

import {
  COLOR_TOKENS,
  type ColorToken,
  type CustomColors,
  applyCustomColors,
  readCustomColors,
  saveCustomColors,
} from "@/lib/custom-colors";
import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

/** Coerce any colour string into the #rrggbb a native picker accepts. */
function normalizeHex(input: string): string {
  let s = (input || "").trim().toLowerCase();
  if (!s.startsWith("#")) s = `#${s}`;
  if (/^#[0-9a-f]{3}$/.test(s)) {
    s = `#${s
      .slice(1)
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }
  return /^#[0-9a-f]{6}$/.test(s) ? s : "#000000";
}

function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex).slice(1);
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Parse any CSS colour (hex, rgb(), rgba(), space-syntax) into hex + alpha. */
function parseColor(input: string): { hex: string; alpha: number } {
  const s = (input || "").trim();
  if (s.startsWith("#")) return { hex: normalizeHex(s), alpha: 1 };
  const nums = s.match(/[\d.]+/g)?.map(Number) ?? [];
  if (nums.length < 3) return { hex: "#000000", alpha: 1 };
  return { hex: rgbToHex(nums[0], nums[1], nums[2]), alpha: nums[3] ?? 1 };
}

/** Build the final CSS value a token stores: hex for solid, rgba for alpha. */
function buildValue(token: ColorToken, hex: string, alpha: number): string {
  if (token.kind !== "alpha") return normalizeHex(hex);
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`;
}

/** Read a token's current effective value (override or theme default). */
function effectiveValue(token: ColorToken): { hex: string; alpha: number } {
  const cs = getComputedStyle(document.documentElement);
  let raw = cs.getPropertyValue(token.var).trim();
  // The glyph colour has no theme default of its own — it falls back to the
  // accent, so seed the control from there.
  if (!raw && token.var === "--color-glyph") raw = cs.getPropertyValue("--color-accent").trim();
  return parseColor(raw);
}

/**
 * Panel that lets anyone recolour the app token by token, on top of whatever
 * theme is active. Solid tokens edit one hex; alpha tokens (cards, borders)
 * add an opacity slider. The choice is saved to localStorage and re-applied
 * before paint by <CustomColorsBoot>.
 */
export function ColorCustomizer() {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(COLOR_TOKENS.map((t) => [t.var, "#000000"])),
  );
  const [alphas, setAlphas] = useState<Record<string, number>>(() =>
    Object.fromEntries(COLOR_TOKENS.map((t) => [t.var, 1])),
  );
  const [overrides, setOverrides] = useState<CustomColors>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const stored = readCustomColors();
    const v: Record<string, string> = {};
    const a: Record<string, number> = {};
    for (const t of COLOR_TOKENS) {
      const parsed = stored[t.var] ? parseColor(stored[t.var]) : effectiveValue(t);
      v[t.var] = parsed.hex;
      a[t.var] = parsed.alpha;
    }
    setValues(v);
    setAlphas(a);
    setOverrides(stored);
  }, []);

  function commit(token: ColorToken, hex: string, alpha: number) {
    const norm = normalizeHex(hex);
    const next = { ...overrides, [token.var]: buildValue(token, norm, alpha) };
    setOverrides(next);
    setValues((s) => ({ ...s, [token.var]: norm }));
    setAlphas((s) => ({ ...s, [token.var]: alpha }));
    setDrafts((d) => {
      const { [token.var]: _drop, ...rest } = d;
      return rest;
    });
    applyCustomColors(next);
    saveCustomColors(next);
  }

  function resetToken(token: ColorToken) {
    const { [token.var]: _drop, ...next } = overrides;
    setOverrides(next);
    applyCustomColors(next); // removes the inline prop → theme value returns
    const parsed = effectiveValue(token);
    setValues((s) => ({ ...s, [token.var]: parsed.hex }));
    setAlphas((s) => ({ ...s, [token.var]: parsed.alpha }));
    setDrafts((d) => {
      const { [token.var]: _d, ...rest } = d;
      return rest;
    });
    saveCustomColors(next);
  }

  function resetAll() {
    setOverrides({});
    applyCustomColors({});
    const v: Record<string, string> = {};
    const a: Record<string, number> = {};
    for (const t of COLOR_TOKENS) {
      const parsed = effectiveValue(t);
      v[t.var] = parsed.hex;
      a[t.var] = parsed.alpha;
    }
    setValues(v);
    setAlphas(a);
    setDrafts({});
    saveCustomColors({});
  }

  const count = Object.keys(overrides).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span
          className="text-eyebrow uppercase tracking-[0.1em]"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          {count > 0
            ? `${count} cor${count > 1 ? "es" : ""} personalizada${count > 1 ? "s" : ""}`
            : "Base neutra"}
        </span>
        {count > 0 ? (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition hover:opacity-80"
            style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
          >
            <RotateCcw size={12} />
            Restaurar tudo
          </button>
        ) : null}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {COLOR_TOKENS.map((t) => {
          const value = values[t.var];
          const alpha = alphas[t.var];
          const isAlpha = t.kind === "alpha";
          const isOverridden = t.var in overrides;
          const draft = drafts[t.var];
          // Preview the swatch at its real opacity for alpha tokens, layered
          // over a checker so low alphas read as translucent.
          let swatchBg = value;
          if (isAlpha) {
            const [r, g, b] = hexToRgb(value);
            const rgba = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            swatchBg = `linear-gradient(${rgba}, ${rgba}), repeating-conic-gradient(#888 0% 25%, #bbb 0% 50%) 0 / 10px 10px`;
          }
          return (
            <div
              key={t.var}
              className="flex items-center gap-3 rounded-lg border p-2.5"
              style={{
                borderColor: isOverridden ? "var(--color-accent)" : "var(--color-border)",
                background: "var(--color-card)",
              }}
            >
              <label
                className="relative h-9 w-9 shrink-0 cursor-pointer rounded-md border"
                style={{ background: swatchBg, borderColor: "var(--color-border)" }}
              >
                <input
                  type="color"
                  value={value}
                  onChange={(e) => commit(t, e.target.value, alpha)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label={`Cor: ${t.label}`}
                />
              </label>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{t.label}</span>
                  {isOverridden ? (
                    <button
                      type="button"
                      onClick={() => resetToken(t)}
                      title="Voltar à cor do tema"
                      className="shrink-0 rounded p-0.5 transition hover:opacity-70"
                      style={{ color: "var(--color-fg-subtle)" }}
                    >
                      <RotateCcw size={12} />
                    </button>
                  ) : null}
                </div>
                <p className="truncate text-[11px]" style={{ color: "var(--color-fg-muted)" }}>
                  {t.hint}
                </p>
              </div>

              {isAlpha ? (
                <div className="flex w-[5.5rem] shrink-0 flex-col items-end gap-1">
                  <span
                    className="font-mono text-[10px] tabular-nums"
                    style={{ color: "var(--color-fg-subtle)" }}
                  >
                    {Math.round(alpha * 100)}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(alpha * 100)}
                    onChange={(e) => commit(t, value, Number(e.target.value) / 100)}
                    className="w-full"
                    style={{ accentColor: "var(--color-accent)" }}
                    aria-label={`Opacidade: ${t.label}`}
                  />
                </div>
              ) : (
                <input
                  type="text"
                  inputMode="text"
                  spellCheck={false}
                  value={draft ?? value}
                  onChange={(e) => setDrafts((d) => ({ ...d, [t.var]: e.target.value }))}
                  onBlur={(e) => commit(t, e.target.value, 1)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  className="w-[5.5rem] shrink-0 rounded-md border bg-transparent px-2 py-1 text-center font-mono text-xs uppercase outline-none focus:ring-1"
                  style={{
                    borderColor: "var(--color-border)",
                    color: "var(--color-fg)",
                    // @ts-expect-error ring colour custom prop
                    "--tw-ring-color": "var(--color-accent)",
                  }}
                  aria-label={`Hex: ${t.label}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px]" style={{ color: "var(--color-fg-subtle)" }}>
        As cores ficam salvas neste navegador e formam o seu tema Personalizar.
      </p>
    </div>
  );
}
