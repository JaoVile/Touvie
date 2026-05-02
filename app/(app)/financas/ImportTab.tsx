"use client";

import { GlassCard } from "@/components/glass/GlassCard";
import { useRef, useState, useTransition } from "react";
import { importCsv } from "./actions";

type Result = { imported: number; skipped: number; source?: string; error?: string };

export function ImportTab() {
  const [result, setResult] = useState<Result | null>(null);
  const [isPending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(fd: FormData) {
    setResult(null);
    start(async () => {
      const res = await importCsv(fd);
      setResult(res);
      if (res.imported > 0) formRef.current?.reset();
    });
  }

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <GlassCard>
        <h3 className="mb-3 font-semibold">📥 Como exportar os arquivos</h3>
        <div className="space-y-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
          <div>
            <p className="mb-1 font-medium" style={{ color: "var(--color-fg)" }}>
              💜 Nubank (fatura do cartão)
            </p>
            <ol className="list-decimal space-y-0.5 pl-4">
              <li>Acesse nubank.com.br pelo computador</li>
              <li>Clique em <strong>Faturas</strong> no menu lateral</li>
              <li>Selecione a fatura desejada</li>
              <li>Clique em <strong>Exportar CSV</strong></li>
            </ol>
          </div>
          <div>
            <p className="mb-1 font-medium" style={{ color: "var(--color-fg)" }}>
              🔵 Mercado Pago (conta)
            </p>
            <ol className="list-decimal space-y-0.5 pl-4">
              <li>Acesse mercadopago.com.br pelo computador</li>
              <li>Vá em <strong>Relatórios → Dinheiro em conta</strong></li>
              <li>Clique em <strong>Criar relatório</strong> e selecione o período</li>
              <li>Baixe o arquivo CSV gerado</li>
            </ol>
          </div>
          <p className="mt-2 rounded-lg p-2 text-xs" style={{ background: "var(--color-surface)" }}>
            💡 O app detecta automaticamente qual banco é — basta subir um arquivo por vez.
            Duplicatas da mesma importação são ignoradas automaticamente.
          </p>
        </div>
      </GlassCard>

      {/* Upload */}
      <GlassCard>
        <h3 className="mb-3 font-semibold">📤 Importar CSV</h3>
        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Selecione o arquivo CSV
            </span>
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              className="block w-full rounded-lg border p-2 text-sm"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
            />
          </label>

          <button
            type="submit"
            disabled={isPending}
            className="gradient-brand w-full rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isPending ? "Importando…" : "Importar transações"}
          </button>
        </form>

        {result && (
          <div
            className="mt-4 rounded-lg p-3 text-sm"
            style={{
              background: result.error ? "var(--color-danger)22" : "var(--color-surface)",
              borderLeft: `3px solid ${result.error ? "var(--color-danger)" : "#10b981"}`,
            }}
          >
            {result.error ? (
              <p style={{ color: "var(--color-danger)" }}>❌ {result.error}</p>
            ) : (
              <>
                <p className="font-medium">
                  ✅ {result.imported} transaç{result.imported === 1 ? "ão" : "ões"} importada
                  {result.imported !== 1 ? "s" : ""}
                  {result.source ? ` (${result.source})` : ""}
                </p>
                {result.skipped > 0 && (
                  <p className="mt-0.5 opacity-60">
                    {result.skipped} já existiam e foram ignoradas.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
