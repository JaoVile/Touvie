"use client";

import { useTransition } from "react";
import { deleteMeasurement } from "./actions";

interface Measurement {
  id: string;
  measured_on: string;
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  bodyfat_pct: number | null;
  notes: string | null;
}

export function MeasurementRow({ m }: { m: Measurement }) {
  const [pending, start] = useTransition();

  function remove() {
    if (!confirm("Apagar este registro?")) return;
    start(async () => {
      await deleteMeasurement(m.id);
    });
  }

  return (
    <li className="rounded px-2 py-1.5 text-xs" style={{ background: "var(--color-card)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono" style={{ color: "var(--color-fg-subtle)" }}>
          {formatDate(m.measured_on)}
        </span>
        <span
          className="flex flex-wrap items-center gap-2 font-mono"
          style={{ color: "var(--color-fg-muted)" }}
        >
          {m.weight_kg != null ? <span>⚖️ {m.weight_kg.toFixed(1)}kg</span> : null}
          {m.waist_cm != null ? <span>cintura {m.waist_cm}</span> : null}
          {m.chest_cm != null ? <span>peito {m.chest_cm}</span> : null}
          {m.arm_cm != null ? <span>braço {m.arm_cm}</span> : null}
          {m.thigh_cm != null ? <span>coxa {m.thigh_cm}</span> : null}
          {m.bodyfat_pct != null ? <span>{m.bodyfat_pct}%</span> : null}
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="ml-2 rounded px-1 hover:opacity-80 disabled:opacity-40"
            style={{ color: "var(--color-fg-subtle)" }}
            aria-label="Apagar"
          >
            ×
          </button>
        </span>
      </div>
      {m.notes ? (
        <p className="mt-1 text-[10px] italic" style={{ color: "var(--color-fg-subtle)" }}>
          {m.notes}
        </p>
      ) : null}
    </li>
  );
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
