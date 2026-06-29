"use client";

import { type QualityTier, readQuality, writeQuality } from "@/lib/quality";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const OPTIONS: { tier: QualityTier; name: string; desc: string }[] = [
  {
    tier: "completo",
    name: "Completo",
    desc: "Todos os efeitos: cursor-fita, vidro fosco, céu de estrelas e animações. Melhor visual.",
  },
  {
    tier: "desempenho",
    name: "Desempenho",
    desc: "Leve e fluido: sem cursor-fita, sem desfoque de vidro nem estrelas. Ideal em máquinas modestas.",
  },
];

export function QualityPicker() {
  // null até hidratar (evita mismatch); então mostra o nível atual (auto-detectado
  // na 1ª vez, ou o salvo).
  const [tier, setTier] = useState<QualityTier | null>(null);

  useEffect(() => {
    setTier(readQuality());
    const onQuality = (e: Event) => {
      const v = (e as CustomEvent).detail;
      if (v === "completo" || v === "desempenho") setTier(v);
    };
    window.addEventListener("touvie:quality", onQuality);
    return () => window.removeEventListener("touvie:quality", onQuality);
  }, []);

  function pick(value: QualityTier) {
    setTier(value);
    writeQuality(value); // salva, aplica no <html> e avisa cursor/estrelas/CSS ao vivo
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((o) => {
        const active = tier === o.tier;
        return (
          <button
            type="button"
            key={o.tier}
            onClick={() => pick(o.tier)}
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
            <span className="font-semibold">{o.name}</span>
            <p className="mt-1 text-xs" style={{ color: "var(--color-fg-muted)" }}>
              {o.desc}
            </p>
          </button>
        );
      })}
    </div>
  );
}
