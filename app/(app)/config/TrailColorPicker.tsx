"use client";

import {
  CURSOR_COLORS,
  CURSOR_COLOR_EVENT,
  CURSOR_COLOR_KEY,
  CUSTOM_CURSOR_ID,
  type CursorColorId,
  type CursorColorPreset,
  type CustomCursor,
  DEFAULT_CURSOR_COLOR,
  DEFAULT_GLOW,
  buildCursorPreset,
  isValidCursorColor,
  readCustomCursor,
  saveCustomCursor,
} from "@/lib/cursor-colors";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

/**
 * Picks the cursor trail palette: three presets plus a "Personalizar" card
 * that reveals ribbon + note colour controls. Everything persists in
 * localStorage and dispatches events CursorTrail picks up live (no reload).
 */
export function TrailColorPicker() {
  const [color, setColor] = useState<CursorColorId>(DEFAULT_CURSOR_COLOR);
  const [custom, setCustom] = useState<CustomCursor>(() => readCustomCursor());

  useEffect(() => {
    const stored = localStorage.getItem(CURSOR_COLOR_KEY);
    if (isValidCursorColor(stored)) setColor(stored);
    setCustom(readCustomCursor());
  }, []);

  function pick(value: CursorColorId) {
    setColor(value);
    localStorage.setItem(CURSOR_COLOR_KEY, value);
    window.dispatchEvent(new CustomEvent(CURSOR_COLOR_EVENT, { detail: value }));
  }

  function updateCustom(patch: Partial<CustomCursor>) {
    const next = { ...custom, ...patch };
    setCustom(next);
    saveCustomCursor(next); // dispatches CURSOR_CUSTOM_EVENT → live ribbon swap
    if (color !== CUSTOM_CURSOR_ID) pick(CUSTOM_CURSOR_ID);
  }

  // Presets + the live "Personalizar" card (its swatch mirrors the chosen colours).
  const cards: CursorColorPreset[] = [...CURSOR_COLORS, buildCursorPreset(custom)];

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => {
          const active = color === c.id;
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => pick(c.id)}
              className={cn(
                "rounded-lg border p-3 text-left transition",
                active ? "ring-2" : "hover:opacity-90",
              )}
              style={{
                background: "var(--color-card)",
                borderColor: active ? "var(--color-accent)" : "var(--color-border)",
                // @ts-expect-error ring-color custom property
                "--tw-ring-color": "var(--color-accent)",
              }}
            >
              <RibbonSwatch preset={c} />
              <span className="font-semibold text-sm">{c.name}</span>
              <p className="mt-1 text-[11px]" style={{ color: "var(--color-fg-muted)" }}>
                {c.description}
              </p>
            </button>
          );
        })}
      </div>

      {color === CUSTOM_CURSOR_ID ? (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <SwatchField
            label="Fita"
            hint="A cor do rastro."
            value={custom.ribbon}
            onChange={(ribbon) => updateCustom({ ribbon })}
          />
          <SwatchField
            label="Notas"
            hint="A cor das notas ♪ ♫."
            value={custom.note}
            onChange={(note) => updateCustom({ note })}
          />
          <OutlineField value={custom.outline} onChange={(outline) => updateCustom({ outline })} />
          <GlowField
            value={custom.glow ?? DEFAULT_GLOW}
            onChange={(glow) => updateCustom({ glow })}
          />
        </div>
      ) : null}
    </>
  );
}

/** Five concentric ribbon strokes with a centred note glyph — the live look. */
function RibbonSwatch({ preset }: { preset: CursorColorPreset }) {
  const ribbon = `rgba(${preset.ribbonRgb},0.9)`;
  const ribbonFaint = `rgba(${preset.ribbonRgb},0.35)`;
  return (
    <div
      className="mb-2 flex h-12 items-center justify-center rounded"
      style={{
        background: `linear-gradient(180deg, transparent 0%, ${ribbonFaint} 35%, ${ribbon} 50%, ${ribbonFaint} 65%, transparent 100%)`,
        border: "1px solid var(--color-border)",
      }}
    >
      <span
        className="text-base"
        style={{
          color: preset.noteFill,
          textShadow: `0 0 4px ${preset.noteShadow}`,
          fontFamily: '"Times New Roman", serif',
        }}
      >
        ♪
      </span>
    </div>
  );
}

/** A colour swatch (native picker over a tile) + label + hex readout. */
function SwatchField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border p-2.5"
      style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
    >
      <label
        className="relative h-9 w-9 shrink-0 cursor-pointer rounded-md border"
        style={{ background: value, borderColor: "var(--color-border)" }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={`Cor: ${label}`}
        />
      </label>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-semibold">{label}</span>
        <p className="truncate text-[11px]" style={{ color: "var(--color-fg-muted)" }}>
          {hint}
        </p>
      </div>
      <span
        className="shrink-0 font-mono text-[11px] uppercase"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        {value}
      </span>
    </div>
  );
}

/** Optional note outline — a toggle that, when on, reveals an outline colour. */
function OutlineField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (outline: string | undefined) => void;
}) {
  const enabled = !!value?.trim();
  const color = value?.trim() || "#000000";
  return (
    <div
      className="flex items-center gap-3 rounded-lg border p-2.5"
      style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
    >
      <label
        className={cn(
          "relative h-9 w-9 shrink-0 rounded-md border",
          enabled ? "cursor-pointer" : "opacity-40",
        )}
        style={{ background: color, borderColor: "var(--color-border)" }}
      >
        <input
          type="color"
          value={color}
          disabled={!enabled}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
          aria-label="Cor do contorno"
        />
      </label>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-semibold">Contorno</span>
        <p className="truncate text-[11px]" style={{ color: "var(--color-fg-muted)" }}>
          Bordinha em volta das notas.
        </p>
      </div>
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked ? color : undefined)}
        className="h-4 w-4 shrink-0 cursor-pointer"
        style={{ accentColor: "var(--color-accent)" }}
        aria-label="Ativar contorno"
      />
    </div>
  );
}

/** Extra detail — the bloom radius around the notes. */
function GlowField({ value, onChange }: { value: number; onChange: (glow: number) => void }) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border p-2.5"
      style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
    >
      <div className="min-w-0 flex-1">
        <span className="text-sm font-semibold">Brilho</span>
        <p className="truncate text-[11px]" style={{ color: "var(--color-fg-muted)" }}>
          Intensidade do brilho das notas.
        </p>
      </div>
      <div className="flex w-[5.5rem] shrink-0 flex-col items-end gap-1">
        <span
          className="font-mono text-[10px] tabular-nums"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          {value}px
        </span>
        <input
          type="range"
          min={0}
          max={16}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: "var(--color-accent)" }}
          aria-label="Brilho das notas"
        />
      </div>
    </div>
  );
}
