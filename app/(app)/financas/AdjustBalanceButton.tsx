"use client";

import { formatBRL } from "@/lib/utils";
import { SlidersHorizontal } from "lucide-react";
import { useState, useTransition } from "react";
import { adjustTotalBalance } from "./actions";

interface Props {
  currentCents: number; // saldo total calculado
}

// Abre um campo pra digitar o saldo REAL total; geramos um lançamento de ajuste
// do tamanho da diferença, pra que o total passe a bater com a realidade.
export function AdjustBalanceButton({ currentCents }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState((currentCents / 100).toFixed(2));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const real = Number.parseFloat(value.replace(",", "."));
    if (!Number.isFinite(real)) return setError("Valor inválido");
    setError("");
    start(async () => {
      const res = await adjustTotalBalance(real);
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue((currentCents / 100).toFixed(2));
          setOpen(true);
        }}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
        style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
      >
        <SlidersHorizontal size={13} />
        Ajustar saldo
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={() => setOpen(false)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <div
        className="w-full max-w-xs space-y-3 rounded-xl border p-4"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-sm font-semibold">Ajustar saldo</p>
          <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
            calculado {formatBRL(currentCents)}
          </p>
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Saldo real (R$)
          </label>
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          />
          <p className="mt-1 text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
            Gera um lançamento de ajuste pela diferença.
          </p>
        </div>
        {error ? (
          <p className="text-xs" style={{ color: "var(--color-danger)" }}>
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="flex-1 rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            {pending ? "Ajustando…" : "Ajustar"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border px-4 py-1.5 text-sm hover:opacity-80"
            style={{ borderColor: "var(--color-border)" }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
