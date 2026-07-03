"use client";

import { RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { resetFinances } from "./actions";

// Apaga lançamentos + contas a pagar + caixinhas (mantém categorias/carteira).
// Confirmação dupla porque é destrutivo — bom pra limpar dados de teste.
export function ResetFinancesButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function confirm() {
    setError("");
    start(async () => {
      const res = await resetFinances();
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
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
        style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
      >
        <RotateCcw size={13} />
        Resetar finanças
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
          <p className="text-sm font-semibold">Resetar finanças?</p>
          <p className="mt-1 text-xs" style={{ color: "var(--color-fg-muted)" }}>
            Apaga <strong>todos os lançamentos, contas a pagar e caixinhas</strong>. O saldo e o "a
            pagar" voltam a zero e o gráfico esvazia. Suas categorias permanecem. Não dá pra
            desfazer.
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
            onClick={confirm}
            className="flex-1 rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--color-danger)" }}
          >
            {pending ? "Apagando…" : "Apagar tudo"}
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
