"use client";

import { GlassCard } from "@/components/glass/GlassCard";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** How long the unlock animation plays before we swap in the editor. */
const UNLOCK_ANIM_MS = 850;

function Padlock({ open }: { open: boolean }) {
  return (
    <div className={`padlock h-24 w-24 ${open ? "is-open" : ""}`}>
      <div className="padlock__glow" />
      <svg className="padlock__svg" width="76" height="76" viewBox="0 0 64 64" aria-hidden="true">
        <path
          className="padlock__shackle"
          d="M21 31 V21 a11 11 0 0 1 22 0 V31"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <rect x="14" y="31" width="36" height="25" rx="6" fill="var(--color-accent)" />
        <circle cx="32" cy="41" r="3.4" fill="var(--color-bg)" />
        <rect x="30.4" y="41" width="3.2" height="7.2" rx="1.6" fill="var(--color-bg)" />
      </svg>
    </div>
  );
}

export function PinGate() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
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
        setPending(false);
        return;
      }
      // Success — play the padlock animation, then reveal the editor. Skip the
      // theatrics (but still unlock) when the user prefers reduced motion.
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setUnlocked(true);
      if (reduce) {
        router.refresh();
      } else {
        window.setTimeout(() => router.refresh(), UNLOCK_ANIM_MS);
      }
    } catch {
      setError("Erro de conexão");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-6 py-6">
      <Padlock open={unlocked} />

      <GlassCard className="w-full">
        <form onSubmit={submit} className="space-y-3 text-center">
          <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
            Digite o PIN. O diário fica aberto por 30 minutos.
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            // biome-ignore lint/a11y/noAutofocus: foco imediato no campo de PIN ao abrir o gate é o comportamento desejado
            autoFocus
            pattern="\d{4,8}"
            minLength={4}
            maxLength={8}
            required
            disabled={unlocked}
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full rounded-lg border px-3 py-3 text-center font-mono text-lg tracking-[0.4em] outline-none focus:ring-2 disabled:opacity-60"
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
            disabled={pending || unlocked || pin.length < 4}
            className="w-full rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            {unlocked ? "Aberto!" : pending ? "Verificando…" : "Desbloquear"}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
