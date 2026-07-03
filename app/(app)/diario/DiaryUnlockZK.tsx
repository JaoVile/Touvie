"use client";

import { GlassCard } from "@/components/glass/GlassCard";
import {
  type WrappedKey,
  normalizeCode,
  normalizePhrase,
  storeSessionDEK,
  unwrapDEK,
} from "@/lib/diary-crypto";
import { useState } from "react";

interface Props {
  wraps: { pin_wrap: WrappedKey; recovery_wrap: WrappedKey; code_wrap: WrappedKey };
  onUnlock: (dek: Uint8Array) => void;
}

type Mode = "pin" | "phrase" | "code";

export function DiaryUnlockZK({ wraps, onUnlock }: Props) {
  const [mode, setMode] = useState<Mode>("pin");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      let dek: Uint8Array;
      if (mode === "pin") {
        dek = await unwrapDEK(wraps.pin_wrap, value);
      } else if (mode === "phrase") {
        dek = await unwrapDEK(wraps.recovery_wrap, normalizePhrase(value));
      } else {
        dek = await unwrapDEK(wraps.code_wrap, normalizeCode(value));
      }
      storeSessionDEK(dek);
      onUnlock(dek);
    } catch {
      setError(
        mode === "pin"
          ? "PIN incorreto."
          : mode === "phrase"
            ? "Palavra-chave incorreta."
            : "Código de recuperação incorreto.",
      );
      setValue("");
      setBusy(false);
    }
  }

  const label =
    mode === "pin" ? "PIN" : mode === "phrase" ? "Palavra-chave" : "Código de recuperação";

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-6">
      <GlassCard className="w-full">
        <form onSubmit={submit} className="space-y-3 text-center">
          <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
            {mode === "pin"
              ? "Digite o PIN pra abrir seu diário privado."
              : mode === "phrase"
                ? "Digite sua palavra-chave do cadastro."
                : "Digite seu código de recuperação."}
          </p>
          <input
            key={mode}
            type={mode === "pin" ? "password" : "text"}
            inputMode={mode === "pin" ? "numeric" : "text"}
            autoComplete="off"
            // biome-ignore lint/a11y/noAutofocus: foco imediato no campo de desbloqueio é o comportamento desejado
            autoFocus
            required
            disabled={busy}
            placeholder={label}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-lg border px-3 py-3 text-center font-mono outline-none focus:ring-2 disabled:opacity-60"
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
            disabled={busy || value.length < 4}
            className="w-full rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            {busy ? "Abrindo…" : "Desbloquear"}
          </button>
        </form>
      </GlassCard>

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
        {mode !== "pin" ? (
          <button type="button" onClick={() => switchTo("pin")} className="underline opacity-80">
            usar o PIN
          </button>
        ) : null}
        {mode !== "phrase" ? (
          <button type="button" onClick={() => switchTo("phrase")} className="underline opacity-80">
            esqueci o PIN — usar palavra-chave
          </button>
        ) : null}
        {mode !== "code" ? (
          <button type="button" onClick={() => switchTo("code")} className="underline opacity-80">
            usar código de recuperação
          </button>
        ) : null}
      </div>
    </div>
  );

  function switchTo(m: Mode) {
    setMode(m);
    setValue("");
    setError(undefined);
  }
}
