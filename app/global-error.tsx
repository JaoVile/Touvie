"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown in the root layout itself (where the
 * normal error.tsx can't help, because the layout — fonts, theme provider,
 * intl — never rendered). It must ship its own <html>/<body> and can't rely on
 * the design tokens, so colors are inlined to the brand fallback (Royal Navy +
 * Gold). Plain reload instead of `reset()` because the whole tree is suspect.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.25rem",
          padding: "1.5rem",
          textAlign: "center",
          background: "#08112e",
          color: "#f5f3ec",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 600, margin: 0 }}>
          O Touvie teve um problema
        </h1>
        <p style={{ maxWidth: "24rem", fontSize: "0.9rem", opacity: 0.7, margin: 0 }}>
          Algo falhou ao carregar o app. Recarregar costuma resolver.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            border: "none",
            borderRadius: "0.5rem",
            padding: "0.6rem 1.2rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#08112e",
            background: "#d4af37",
            cursor: "pointer",
          }}
        >
          Recarregar
        </button>
        {error.digest ? (
          <p style={{ fontSize: "0.7rem", opacity: 0.45, margin: 0 }}>Código: {error.digest}</p>
        ) : null}
      </body>
    </html>
  );
}
