"use client";

import { useEffect, useState } from "react";
import {
  CURSOR_COLOR_EVENT,
  CURSOR_COLOR_KEY,
  CURSOR_COLORS,
  type CursorColorId,
  DEFAULT_CURSOR_COLOR,
  isValidCursorColor,
} from "@/lib/cursor-colors";
import { cn } from "@/lib/utils";

/**
 * Picks the cursor trail palette. Lives next to the size picker — both
 * persist in localStorage and dispatch custom events that CursorTrail
 * picks up live (no reload). Mirrors the TrailSizePicker shape.
 */
export function TrailColorPicker() {
  const [color, setColor] = useState<CursorColorId>(DEFAULT_CURSOR_COLOR);

  useEffect(() => {
    const stored = localStorage.getItem(CURSOR_COLOR_KEY);
    if (isValidCursorColor(stored)) setColor(stored);
  }, []);

  function pick(value: CursorColorId) {
    setColor(value);
    localStorage.setItem(CURSOR_COLOR_KEY, value);
    window.dispatchEvent(new CustomEvent(CURSOR_COLOR_EVENT, { detail: value }));
  }

  return (
    <div className="grid gap-3 sm:grid-cols-5">
      {CURSOR_COLORS.map((c) => {
        const active = color === c.id;
        // Build a CSS gradient swatch from the preset's actual colours so the
        // tile previews what the cursor will look like (ribbon + note).
        const ribbon = `rgba(${c.ribbonRgb},0.9)`;
        const ribbonFaint = `rgba(${c.ribbonRgb},0.35)`;
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
            {/* Swatch — five concentric ribbon strokes with a note glyph
                in the centre, mimicking the live trail look. */}
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
                  color: c.noteFill,
                  textShadow: `0 0 4px ${c.noteShadow}`,
                  fontFamily: '"Times New Roman", serif',
                }}
              >
                ♪
              </span>
            </div>
            <span className="font-semibold text-sm">{c.name}</span>
            <p className="mt-1 text-[11px]" style={{ color: "var(--color-fg-muted)" }}>
              {c.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
