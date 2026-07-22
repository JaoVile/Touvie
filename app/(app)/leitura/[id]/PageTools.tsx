"use client";

import { extractLayerText, needsOcr, renderPageToDataUrl } from "@/lib/leitura-page-text";
import { Copy, Download, Loader2, Pause, Play, Sparkles, Square, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";

type PageToolsProps = {
  doc: PDFDocumentProxy | null;
  bookId: string;
  page: number;
  onClose: () => void;
};

type Tab = "texto" | "ouvir" | "ia";

export function PageTools({ doc, bookId, page, onClose }: PageToolsProps) {
  const [tab, setTab] = useState<Tab>("texto");
  const [text, setText] = useState("");
  const [loadingText, setLoadingText] = useState(false);
  const [ocrNeeded, setOcrNeeded] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [textError, setTextError] = useState("");

  // Extrai o texto da camada sempre que a página muda.
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setLoadingText(true);
    setTextError("");
    setOcrNeeded(false);
    extractLayerText(doc, page)
      .then((t) => {
        if (cancelled) return;
        setText(t);
        setOcrNeeded(needsOcr(t));
      })
      .catch(() => !cancelled && setTextError("Não consegui ler o texto desta página."))
      .finally(() => !cancelled && setLoadingText(false));
    return () => {
      cancelled = true;
    };
  }, [doc, page]);

  const runOcr = useCallback(async () => {
    if (!doc) return;
    setOcrRunning(true);
    setTextError("");
    try {
      const image = await renderPageToDataUrl(doc, page);
      const res = await fetch("/api/leitura/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, page, image }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error ?? "falha");
      setText(data.text);
      setOcrNeeded(false);
    } catch {
      setTextError("OCR indisponível agora. Tente de novo.");
    } finally {
      setOcrRunning(false);
    }
  }, [doc, bookId, page]);

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l shadow-xl sm:w-96"
      style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
    >
      <header
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <Sparkles
            className="h-4 w-4"
            aria-hidden
            strokeWidth={1.6}
            style={{ color: "var(--color-accent)" }}
          />
          <span className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>
            Ferramentas · pág. {page}
          </span>
        </div>
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="rounded-md p-1.5 hover:opacity-80"
        >
          <X
            className="h-4 w-4"
            aria-hidden
            strokeWidth={1.6}
            style={{ color: "var(--color-fg-subtle)" }}
          />
        </button>
      </header>

      <nav
        className="flex gap-1 border-b px-2 py-1.5"
        style={{ borderColor: "var(--color-border)" }}
      >
        {(["texto", "ouvir", "ia"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="rounded-md px-3 py-1.5 text-xs capitalize transition"
            style={{
              background:
                tab === t
                  ? "color-mix(in srgb, var(--color-accent) 16%, var(--color-card))"
                  : "transparent",
              color: tab === t ? "var(--color-accent)" : "var(--color-fg-muted)",
            }}
          >
            {t === "ia" ? "IA" : t}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto p-4">
        {loadingText ? (
          <Spinner label="Lendo a página…" />
        ) : tab === "texto" ? (
          <TextoTab
            text={text}
            ocrNeeded={ocrNeeded}
            ocrRunning={ocrRunning}
            error={textError}
            onOcr={runOcr}
            page={page}
          />
        ) : tab === "ouvir" ? (
          <OuvirTab text={text} />
        ) : (
          <IaTab text={text} />
        )}
      </div>
    </aside>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-6" style={{ color: "var(--color-fg-muted)" }}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function TextoTab(props: {
  text: string;
  ocrNeeded: boolean;
  ocrRunning: boolean;
  error: string;
  onOcr: () => void;
  page: number;
}) {
  const { text, ocrNeeded, ocrRunning, error, onOcr, page } = props;
  const copy = () => navigator.clipboard?.writeText(text);
  const download = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pagina-${page}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="space-y-3">
      {ocrNeeded && !text ? (
        <div className="space-y-2">
          <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
            Esta página parece ser imagem (escaneada), sem texto extraível.
          </p>
          <button
            type="button"
            onClick={onOcr}
            disabled={ocrRunning}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition hover:opacity-80 disabled:opacity-50"
            style={{
              background: "color-mix(in srgb, var(--color-accent) 16%, var(--color-card))",
              color: "var(--color-accent)",
            }}
          >
            {ocrRunning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {ocrRunning ? "Extraindo…" : "Extrair com OCR"}
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
      {text ? (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:opacity-80"
              style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden strokeWidth={1.6} /> Copiar
            </button>
            <button
              type="button"
              onClick={download}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:opacity-80"
              style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
            >
              <Download className="h-3.5 w-3.5" aria-hidden strokeWidth={1.6} /> Baixar .txt
            </button>
          </div>
          <p
            className="whitespace-pre-wrap text-sm leading-relaxed"
            style={{ color: "var(--color-fg)" }}
          >
            {text}
          </p>
        </>
      ) : !ocrNeeded ? (
        <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
          Sem texto nesta página.
        </p>
      ) : null}
    </div>
  );
}

function OuvirTab({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const uRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Para a fala ao trocar de página/desmontar (o texto muda).
  // biome-ignore lint/correctness/useExhaustiveDependencies: text é o gatilho — o efeito só cancela a fala, mas precisa rodar de novo (cancelando a anterior) sempre que o texto da página mudar
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported, text]);

  if (!supported) {
    return (
      <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
        Seu navegador não tem leitura em voz.
      </p>
    );
  }
  if (!text) {
    return (
      <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
        Sem texto pra ler nesta página.
      </p>
    );
  }

  const play = () => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.onend = () => {
      setSpeaking(false);
      setPaused(false);
    };
    uRef.current = u;
    window.speechSynthesis.speak(u);
    setSpeaking(true);
    setPaused(false);
  };
  const toggle = () => {
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  };
  const stop = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  };

  return (
    <div className="flex items-center gap-2">
      {!speaking ? (
        <button
          type="button"
          onClick={play}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm"
          style={{
            background: "color-mix(in srgb, var(--color-accent) 16%, var(--color-card))",
            color: "var(--color-accent)",
          }}
        >
          <Play className="h-4 w-4" aria-hidden strokeWidth={1.6} /> Ouvir a página
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={toggle}
            className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
          >
            {paused ? (
              <Play className="h-4 w-4" aria-hidden strokeWidth={1.6} />
            ) : (
              <Pause className="h-4 w-4" aria-hidden strokeWidth={1.6} />
            )}
            {paused ? "Continuar" : "Pausar"}
          </button>
          <button
            type="button"
            onClick={stop}
            className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
          >
            <Square className="h-4 w-4" aria-hidden strokeWidth={1.6} /> Parar
          </button>
        </>
      )}
    </div>
  );
}

function IaTab({ text }: { text: string }) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");

  const ask = async (mode: "resumir" | "explicar" | "perguntar") => {
    if (!text.trim()) {
      setError("Sem texto nesta página pra IA analisar.");
      return;
    }
    setLoading(true);
    setError("");
    setAnswer("");
    try {
      const res = await fetch("/api/leitura/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode, question: mode === "perguntar" ? question : undefined }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok || !data.answer) throw new Error(data.error ?? "falha");
      setAnswer(data.answer);
    } catch {
      setError("O Toube está fora do ar agora. Tente de novo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => ask("resumir")}
          disabled={loading}
          className="rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
          style={{
            background: "color-mix(in srgb, var(--color-accent) 16%, var(--color-card))",
            color: "var(--color-accent)",
          }}
        >
          Resumir
        </button>
        <button
          type="button"
          onClick={() => ask("explicar")}
          disabled={loading}
          className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
        >
          Explicar mais simples
        </button>
      </div>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && question.trim() && ask("perguntar")}
          placeholder="Pergunte sobre esta página…"
          className="flex-1 rounded-md border px-2.5 py-1.5 text-sm outline-none"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-bg)",
            color: "var(--color-fg)",
          }}
        />
        <button
          type="button"
          onClick={() => question.trim() && ask("perguntar")}
          disabled={loading || !question.trim()}
          className="rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
          style={{
            background: "color-mix(in srgb, var(--color-accent) 16%, var(--color-card))",
            color: "var(--color-accent)",
          }}
        >
          Perguntar
        </button>
      </div>
      {loading ? <Spinner label="O Toube está pensando…" /> : null}
      {error ? (
        <p className="text-sm" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
      {answer ? (
        <p
          className="whitespace-pre-wrap rounded-md p-3 text-sm leading-relaxed"
          style={{ background: "var(--color-bg)", color: "var(--color-fg)" }}
        >
          {answer}
        </p>
      ) : null}
    </div>
  );
}
