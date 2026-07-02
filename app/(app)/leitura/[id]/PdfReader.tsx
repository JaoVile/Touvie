"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { saveCurrentPage } from "../actions";

/**
 * Leitor de PDF. Usa o visualizador NATIVO do navegador via <iframe> sobre a
 * URL assinada — robusto, sem dependências nem worker do pdf.js. Ocupa quase
 * toda a altura útil pra leitura confortável; a barra do app continua acessível.
 *
 * Retomada: o viewer nativo aceita `#page=N` na carga, mas não conta pra JS em
 * que página o leitor está. Então a marcação é manual — "parei na pág. X" — e
 * a próxima abertura já nasce lá.
 */
export function PdfReader({
  url,
  title,
  bookId,
  initialPage,
}: {
  url: string;
  title: string;
  bookId: string;
  initialPage: number;
}) {
  const [page, setPage] = useState(String(Math.max(1, initialPage)));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const src = initialPage > 1 ? `${url}#page=${initialPage}` : url;

  async function save() {
    const n = Number.parseInt(page, 10);
    if (!Number.isInteger(n) || n < 1) {
      setState("error");
      return;
    }
    setState("saving");
    const res = await saveCurrentPage(bookId, n);
    setState(res.error ? "error" : "saved");
  }

  return (
    <div>
      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        <iframe
          src={src}
          title={title || "PDF"}
          className="h-[calc(100vh-14rem)] min-h-[60vh] w-full"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-fg-muted)" }}>
          <label htmlFor="current-page">Parei na pág.</label>
          <input
            id="current-page"
            type="number"
            min={1}
            value={page}
            onChange={(e) => {
              setPage(e.target.value);
              setState("idle");
            }}
            className="w-20 rounded-lg border px-2 py-1 text-sm outline-none transition focus:ring-2"
            style={{
              background: "var(--color-card)",
              borderColor: "var(--color-border)",
              color: "var(--color-fg)",
            }}
          />
          <button
            type="button"
            onClick={save}
            disabled={state === "saving"}
            className="rounded-lg border px-3 py-1 text-xs transition hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: "var(--color-border)", color: "var(--color-fg)" }}
          >
            {state === "saving" ? "Salvando…" : "Marcar"}
          </button>
          {state === "saved" ? (
            <span style={{ color: "var(--color-success)" }}>
              Salvo — a próxima leitura abre aí.
            </span>
          ) : null}
          {state === "error" ? (
            <span style={{ color: "var(--color-danger)" }}>Página inválida.</span>
          ) : null}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs transition hover:opacity-80"
          style={{ color: "var(--color-fg-muted)" }}
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden strokeWidth={1.6} />
          Abrir em nova aba
        </a>
      </div>
    </div>
  );
}
