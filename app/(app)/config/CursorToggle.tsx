"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

// Espelha as constantes em components/CursorTrail.tsx.
const STORAGE_KEY = "touvie:cursor";
const EVENT = "touvie:cursor";

const OPTIONS = [
  { on: true, name: "Ligado", desc: "Rastro de pauta musical seguindo o cursor." },
  { on: false, name: "Desligado", desc: "Cursor comum. Mais leve em máquinas modestas." },
] as const;

export function CursorToggle() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(localStorage.getItem(STORAGE_KEY) !== "off");
  }, []);

  function pick(value: boolean) {
    setOn(value);
    localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
    // O CursorTrail escuta isto e liga/desliga na hora, sem reload.
    window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((o) => (
        <button
          type="button"
          key={o.name}
          onClick={() => pick(o.on)}
          className={cn(
            "rounded-lg border p-3 text-left transition",
            on === o.on ? "ring-2" : "hover:opacity-90",
          )}
          style={{
            background: "var(--color-card)",
            borderColor: on === o.on ? "var(--color-accent)" : "var(--color-border)",
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
