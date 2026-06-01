"use client";

import { GlassCard } from "@/components/glass/GlassCard";
import { CheckCircle2, Download, Lightbulb, Trash2, Upload, XCircle } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { countImportedTransactions, deleteImportedTransactions, importCsv } from "./actions";

type Result = { imported: number; skipped: number; source?: string; error?: string };

export function ImportTab() {
  const [result, setResult] = useState<Result | null>(null);
  const [isPending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Quantos lançamentos importados existem (pra oferecer a limpeza em massa).
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [clearing, startClear] = useTransition();

  function refreshCount() {
    countImportedTransactions().then(setImportedCount);
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshCount is stable enough for mount-only load
  useEffect(() => {
    refreshCount();
  }, []);

  function handleSubmit(fd: FormData) {
    setResult(null);
    start(async () => {
      const res = await importCsv(fd);
      setResult(res);
      if (res.imported > 0) {
        formRef.current?.reset();
        refreshCount();
      }
    });
  }

  function handleClear() {
    if (
      !confirm(
        `Apagar ${importedCount} lançamento(s) importado(s)? Os lançamentos que você criou à mão não são afetados. Esta ação não pode ser desfeita.`,
      )
    )
      return;
    startClear(async () => {
      const res = await deleteImportedTransactions();
      if (res.error) {
        setResult({ imported: 0, skipped: 0, error: res.error });
      } else {
        setImportedCount(0);
        setResult(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <GlassCard>
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Download size={16} />
          Como exportar os arquivos
        </h3>
        <div className="space-y-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
          <div>
            <p
              className="mb-1 flex items-center gap-2 font-medium"
              style={{ color: "var(--color-fg)" }}
            >
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: "#820ad1" }}
              />
              Nubank (fatura do cartão)
            </p>
            <ol className="list-decimal space-y-0.5 pl-4">
              <li>Acesse nubank.com.br pelo computador</li>
              <li>
                Clique em <strong>Faturas</strong> no menu lateral
              </li>
              <li>Selecione a fatura desejada</li>
              <li>
                Clique em <strong>Exportar CSV</strong>
              </li>
            </ol>
          </div>
          <div>
            <p
              className="mb-1 flex items-center gap-2 font-medium"
              style={{ color: "var(--color-fg)" }}
            >
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: "#009ee3" }}
              />
              Mercado Pago (conta)
            </p>
            <ol className="list-decimal space-y-0.5 pl-4">
              <li>Acesse mercadopago.com.br pelo computador</li>
              <li>
                Vá em <strong>Relatórios → Dinheiro em conta</strong>
              </li>
              <li>
                Clique em <strong>Criar relatório</strong> e selecione o período
              </li>
              <li>Baixe o arquivo CSV gerado</li>
            </ol>
          </div>
          <p
            className="mt-2 flex items-start gap-1.5 rounded-lg p-2 text-xs"
            style={{ background: "var(--color-surface)" }}
          >
            <Lightbulb size={14} className="mt-0.5 shrink-0" />
            <span>
              O app detecta automaticamente qual banco é — basta subir um arquivo por vez.
              Duplicatas da mesma importação são ignoradas automaticamente.
            </span>
          </p>
        </div>
      </GlassCard>

      {/* Upload */}
      <GlassCard>
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Upload size={16} />
          Importar CSV
        </h3>
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
              <p className="flex items-center gap-1.5" style={{ color: "var(--color-danger)" }}>
                <XCircle size={15} className="shrink-0" />
                {result.error}
              </p>
            ) : (
              <>
                <p className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 size={15} className="shrink-0" style={{ color: "#10b981" }} />
                  {result.imported} transaç{result.imported === 1 ? "ão" : "ões"} importada
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

      {/* Limpeza — apaga em massa os lançamentos que vieram de importação,
          sem tocar nos que você criou à mão. */}
      {importedCount && importedCount > 0 ? (
        <GlassCard>
          <h3 className="mb-1 flex items-center gap-2 font-semibold">
            <Trash2 size={16} />
            Limpar importações
          </h3>
          <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
            Você tem <strong>{importedCount}</strong> lançamento(s) vindo(s) de importação de
            extrato. Apagá-los remove o fluxo bruto que infla os gráficos — seus lançamentos manuais
            não são afetados.
          </p>
          <button
            type="button"
            onClick={handleClear}
            disabled={clearing}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
          >
            <Trash2 size={15} />
            {clearing ? "Apagando…" : `Apagar ${importedCount} lançamento(s) importado(s)`}
          </button>
        </GlassCard>
      ) : null}
    </div>
  );
}
