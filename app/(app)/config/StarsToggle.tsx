"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

// Espelha as constantes em components/StarField.tsx.
const STORAGE_KEY = "touvie:stars";
const EVENT = "touvie:stars";

const OPTIONS = [
  { on: true, name: "Ligado", desc: "Céu de estrelas cintilando ao fundo." },
  { on: false, name: "Desligado", desc: "Fundo limpo, sem estrelas." },
] as const;

export function StarsToggle() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(localStorage.getItem(STORAGE_KEY) !== "off");
  }, []);

  function pick(value: boolean) {
    setOn(value);
    localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
    // O StarField escuta isto e liga/desliga na hora, sem reload.
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
