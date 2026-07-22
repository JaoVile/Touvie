import type { PDFDocumentProxy } from "pdfjs-dist";

/** Junta o texto da camada de texto de uma página do PDF (grátis, instantâneo). */
export async function extractLayerText(doc: PDFDocumentProxy, page: number): Promise<string> {
  const pg = await doc.getPage(page);
  const content = await pg.getTextContent();
  return content.items
    .map((it) => ("str" in it ? it.str : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Heurística: página com quase nenhum caractere → provável escaneada, precisa de OCR. */
export function needsOcr(layerText: string): boolean {
  return layerText.replace(/\s/g, "").length < 20;
}

/** Renderiza uma página num canvas offscreen e devolve um data URL (webp) pro OCR. */
export async function renderPageToDataUrl(
  doc: PDFDocumentProxy,
  page: number,
  maxWidth = 1000,
): Promise<string> {
  const pg = await doc.getPage(page);
  const base = pg.getViewport({ scale: 1 });
  const scale = Math.min(maxWidth / base.width, 2);
  const viewport = pg.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível");
  await pg.render({ canvasContext: ctx, canvas: null, viewport }).promise;
  return canvas.toDataURL("image/webp", 0.85);
}
