"use client";
import type { Plan } from "@/lib/planos-draft";
import { useRef, useState } from "react";

export function SourceInput({ onResult }: { onResult: (reply: string, plan: Plan) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  async function sendUrl() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setErr(undefined);
    try {
      const res = await fetch("/api/toube/planos/fonte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha na fonte.");
      setUrl("");
      onResult(data.reply, data.plan);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  async function sendPdf(file: File) {
    setBusy(true);
    setErr(undefined);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/toube/planos/fonte", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no PDF.");
      onResult(data.reply, data.plan);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Cola um link do YouTube ou site…"
          className="flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none"
          style={{ borderColor: "var(--color-border)", color: "var(--color-fg)" }}
        />
        <button
          type="button"
          onClick={sendUrl}
          disabled={busy || !url.trim()}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          style={{ background: "var(--gradient-brand)" }}
        >
          {busy ? "…" : "Usar"}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
        >
          PDF
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => e.target.files?.[0] && sendPdf(e.target.files[0])}
        />
      </div>
      {err ? (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {err}
        </p>
      ) : null}
    </div>
  );
}
