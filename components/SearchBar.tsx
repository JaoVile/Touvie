"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";

export function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = inputRef.current?.value.trim() ?? "";
    if (!q) return;
    router.push(`/busca?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2.5">
      <input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={params.get("q") ?? ""}
        autoFocus={autoFocus}
        placeholder="Buscar transações, diário…"
        className="flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors placeholder:opacity-60 focus:border-transparent focus:ring-2"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-card)",
          color: "var(--color-fg)",
        }}
      />
      <button
        type="submit"
        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-transform active:scale-95"
        style={{ background: "var(--gradient-brand)" }}
      >
        Buscar
      </button>
    </form>
  );
}
