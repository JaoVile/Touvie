"use client";

import { THEMES } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ExternalLink, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { useReadingProgress } from "./useReadingProgress";

// Worker do pdf.js servido pelo bundler (Turbopack resolve a URL do asset).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/** Marcação de trecho — preenchida na Task 5 (highlights). */
export type Highlight = {
  id: string;
  page: number;
  rects: { x: number; y: number; w: number; h: number }[];
  text: string;
  color: string;
  note: string | null;
};

type PdfReaderProps = {
  url: string;
  title: string;
  bookId: string;
  initialPage: number;
  highlights: Highlight[];
};

/** Teto de largura pra leitura confortável em telas largas. */
const MAX_WIDTH = 900;

/** Segue o tema atual do app (`data-theme` no <html>) como default do toggle. */
function appThemeIsDark(): boolean {
  if (typeof document === "undefined") return false;
  const id = document.documentElement.getAttribute("data-theme");
  const theme = THEMES.find((t) => t.id === id);
  return (theme?.mode ?? "dark") === "dark";
}

export function PdfReader({ url, title, bookId, initialPage, highlights = [] }: PdfReaderProps) {
  const progress = useReadingProgress(bookId);

  const [data, setData] = useState<Uint8Array>();
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(Math.max(1, initialPage || 1));
  const [dark, setDark] = useState(appThemeIsDark);
  const [width, setWidth] = useState(MAX_WIDTH);

  const containerRef = useRef<HTMLDivElement>(null);

  // Baixa os bytes uma única vez — a signed URL do Storage expira em 1h e não
  // pode ficar sendo refeita a cada re-render/troca de página.
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        if (!cancelled) setData(new Uint8Array(buf));
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const file = useMemo(() => (data ? { data } : undefined), [data]);

  // Largura responsiva: acompanha o container (mobile encolhe), até um teto de leitura.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.min(w, MAX_WIDTH));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const goTo = useCallback(
    (next: number) => {
      const clamped = numPages > 0 ? Math.min(Math.max(next, 1), numPages) : Math.max(next, 1);
      if (clamped === page) return;
      setPage(clamped);
      progress.save(clamped, numPages || undefined);
    },
    [numPages, page, progress],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goTo(page - 1);
      if (e.key === "ArrowRight") goTo(page + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, page]);

  const pageHighlights = useMemo(
    () => highlights.filter((h) => h.page === page),
    [highlights, page],
  );

  return (
    <div>
      <div
        ref={containerRef}
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        <div
          className="flex items-center justify-between gap-2 border-b px-3 py-2"
          style={{ borderColor: "var(--color-border)" }}
        >
          <button
            type="button"
            aria-label="Página anterior"
            disabled={page <= 1}
            onClick={() => goTo(page - 1)}
            className="rounded-md p-1.5 transition hover:opacity-80 disabled:opacity-30"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden strokeWidth={1.6} />
          </button>

          <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
            Página {page} de {numPages || "…"}
            {pageHighlights.length > 0 && ` · ${pageHighlights.length} marcação(ões)`}
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={dark ? "Desativar tema escuro na página" : "Ativar tema escuro na página"}
              aria-pressed={dark}
              onClick={() => setDark((d) => !d)}
              className="rounded-md p-1.5 transition hover:opacity-80"
              style={{ color: "var(--color-fg-subtle)" }}
            >
              {dark ? (
                <Sun className="h-4 w-4" aria-hidden strokeWidth={1.6} />
              ) : (
                <Moon className="h-4 w-4" aria-hidden strokeWidth={1.6} />
              )}
            </button>
            <button
              type="button"
              aria-label="Próxima página"
              disabled={numPages > 0 && page >= numPages}
              onClick={() => goTo(page + 1)}
              className="rounded-md p-1.5 transition hover:opacity-80 disabled:opacity-30"
              style={{ color: "var(--color-fg-subtle)" }}
            >
              <ChevronRight className="h-4 w-4" aria-hidden strokeWidth={1.6} />
            </button>
          </div>
        </div>

        <div
          className={cn("flex justify-center overflow-auto p-3")}
          style={{ filter: dark ? "invert(1) hue-rotate(180deg)" : undefined }}
        >
          <Document
            file={file}
            loading={
              <p className="py-10 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                Carregando PDF…
              </p>
            }
            error={
              <p className="py-10 text-sm" style={{ color: "var(--color-danger)" }}>
                Não consegui abrir este PDF.
              </p>
            }
            onLoadSuccess={(d) => {
              setNumPages(d.numPages);
              progress.save(page, d.numPages);
            }}
          >
            <Page pageNumber={page} width={width} renderTextLayer renderAnnotationLayer={false} />
          </Document>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="truncate text-xs" style={{ color: "var(--color-fg-muted)" }}>
          {title}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1.5 text-xs transition hover:opacity-80"
          style={{ color: "var(--color-fg-muted)" }}
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden strokeWidth={1.6} />
          Abrir em nova aba
        </a>
      </div>
    </div>
  );
}
