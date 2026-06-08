"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-segment error boundary. Catches any exception thrown while rendering
 * a page/server component below the root layout and degrades to a recoverable
 * card instead of nuking the whole app to a raw 500. In production a transient
 * Supabase network blip in an unguarded server component used to take the
 * entire screen down — now it lands here with a retry.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces in the browser console and (with the digest) lets us correlate
    // against the matching entry in the Vercel runtime logs.
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <p
          className="text-xs uppercase tracking-[0.2em]"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          Algo quebrou
        </p>
        <h1
          className="text-3xl"
          style={{
            fontFamily: "var(--font-instrument-serif)",
            color: "var(--color-fg)",
          }}
        >
          Essa tela teve um soluço
        </h1>
        <p className="max-w-sm text-sm" style={{ color: "var(--color-fg-muted)" }}>
          Pode ter sido uma falha momentânea de conexão. Tenta de novo — o resto do app continua
          funcionando.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          <RotateCw size={15} />
          Tentar de novo
        </button>
        <Link
          href="/"
          className="rounded-lg px-4 py-2 text-sm font-medium"
          style={{
            border: "1px solid var(--color-border)",
            color: "var(--color-fg-muted)",
          }}
        >
          Ir pro início
        </Link>
      </div>

      {error.digest ? (
        <p className="text-[11px]" style={{ color: "var(--color-fg-subtle)" }}>
          Código: {error.digest}
        </p>
      ) : null}
    </main>
  );
}
