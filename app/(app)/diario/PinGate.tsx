"use client";

import { GlassCard } from "@/components/glass/GlassCard";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PinGate() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      const res = await fetch("/api/diary/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Não foi possível desbloquear");
        setPin("");
      } else {
        router.refresh();
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setPending(false);
    }
  }

  return (
    <GlassCard className="max-w-sm">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
          Digite o PIN. O diário fica aberto por 30 minutos.
        </p>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          pattern="\d{4,8}"
          minLength={4}
          maxLength={8}
          required
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-lg border px-3 py-3 text-center font-mono text-lg tracking-[0.4em] outline-none focus:ring-2"
          style={{
            background: "var(--color-card)",
            borderColor: "var(--color-border)",
            color: "var(--color-fg)",
          }}
        />
        {error ? (
          <p className="text-sm" style={{ color: "var(--color-danger)" }}>
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || pin.length < 4}
          className="w-full rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          {pending ? "Verificando…" : "Desbloquear"}
        </button>
      </form>
    </GlassCard>
  );
}
