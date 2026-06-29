"use client";

import { ExternalLink } from "lucide-react";

/**
 * Leitor de PDF. Usa o visualizador NATIVO do navegador via <iframe> sobre a
 * URL assinada — robusto, sem dependências nem worker do pdf.js. Ocupa quase
 * toda a altura útil pra leitura confortável; a barra do app continua acessível.
 */
export function PdfReader({ url, title }: { url: string; title: string }) {
  return (
    <div>
      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        <iframe
          src={url}
          title={title || "PDF"}
          className="h-[calc(100vh-14rem)] min-h-[60vh] w-full"
        />
      </div>
      <div className="mt-2 flex justify-end">
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
