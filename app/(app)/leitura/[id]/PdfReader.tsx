"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Worker do pdf.js servido pelo bundler (Turbopack/webpack resolvem a URL do asset).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function PdfReader({ url, title }: { url: string; title: string }) {
  const [numPages, setNumPages] = useState(0);
  return (
    <div>
      <Document file={url} onLoadSuccess={(d) => setNumPages(d.numPages)}>
        <Page pageNumber={1} width={600} />
      </Document>
      <p className="mt-2 text-xs" style={{ color: "var(--color-fg-muted)" }}>
        {title} — {numPages} páginas
      </p>
    </div>
  );
}
