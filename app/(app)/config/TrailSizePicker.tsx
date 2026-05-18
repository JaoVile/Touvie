"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

// Mirrors the constants in components/CursorTrail.tsx.
const STORAGE_KEY = "touvie:trailScale";
const EVENT = "touvie:trail-scale";

const OPTIONS = [
  { value: 1, name: "Padrão", desc: "Tamanho atual da fita rítmica." },
  { value: 2, name: "Médio", desc: "100% maior — fita e notas em dobro." },
  { value: 3, name: "Grande", desc: "200% maior — rastro bem destacado." },
] as const;

export function TrailSizePicker() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    if (stored === 2 || stored === 3) setScale(stored);
  }, []);

  function pick(value: number) {
    setScale(value);
    localStorage.setItem(STORAGE_KEY, String(value));
    // The trail listens for this and resizes live, no reload needed.
    window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => pick(o.value)}
          className={cn(
            "rounded-lg border p-3 text-left transition",
            scale === o.value ? "ring-2" : "hover:opacity-90",
          )}
          style={{
            background: "var(--color-card)",
            borderColor:
              scale === o.value ? "var(--color-accent)" : "var(--color-border)",
            // @ts-expect-error ring-color custom property
            "--tw-ring-color": "var(--color-accent)",
          }}
        >
          <span className="font-semibold">{o.name}</span>
          <p className="mt-1 text-xs" style={{ color: "var(--color-fg-muted)" }}>
            {o.desc}
          </p>
        </button>
      ))}
    </div>
  );
}
