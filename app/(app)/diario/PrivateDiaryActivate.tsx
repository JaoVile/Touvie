"use client";

import {
  encryptEntry,
  generateDEK,
  generateRecoveryCode,
  normalizeCode,
  normalizePhrase,
  storeSessionDEK,
  wrapDEK,
} from "@/lib/diary-crypto";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { activatePrivateDiary } from "./crypto-actions";

interface Props {
  editable: boolean;
  entries: { week_start: string; content: string }[];
}

const inputCls = "w-full rounded-lg border px-3 py-2 outline-none transition focus:ring-2";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};

export function PrivateDiaryActivate({ editable, entries }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string>();
  const [saved, setSaved] = useState(false);

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!/^\d{4,8}$/.test(pin)) return setError("PIN deve ter 4 a 8 dígitos.");
    if (pin !== confirm) return setError("Os PINs não conferem.");
    if (normalizePhrase(phrase).length < 6) return setError("Palavra-chave muito curta.");

    setBusy(true);
    try {
      const dek = generateDEK();
      const code = generateRecoveryCode();
      const [pin_wrap, recovery_wrap, code_wrap] = await Promise.all([
        wrapDEK(dek, pin),
        wrapDEK(dek, normalizePhrase(phrase)),
        wrapDEK(dek, normalizeCode(code)),
      ]);
      const encrypted = await Promise.all(
        entries.map(async (en) => ({
          week_start: en.week_start,
          content: await encryptEntry(en.content, dek),
        })),
      );
      const res = await activatePrivateDiary({
        pin_wrap,
        recovery_wrap,
        code_wrap,
        entries: encrypted,
      });
      if (res.error) {
        setError(res.error);
        setBusy(false);
        return;
      }
      // Mantém a DEK na sessão pra o diário abrir já destrancado.
      storeSessionDEK(dek);
      setRecoveryCode(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao ativar.");
    } finally {
      setBusy(false);
    }
  }

  // Tela do código de recuperação — mostrado UMA vez.
  if (recoveryCode) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-fg)" }}>
            Guarde seu código de recuperação
          </h3>
          <p className="mt-1 text-sm" style={{ color: "var(--color-fg-muted)" }}>
            É a <strong>3ª chave</strong> do seu diário — junto com o PIN e a palavra-chave. Se
            esquecer o PIN, é com ele (ou a palavra-chave) que você volta a entrar.{" "}
            <strong style={{ color: "var(--color-danger)" }}>
              Não mostramos de novo. Perder as três = perder o diário pra sempre.
            </strong>
          </p>
        </div>
        <div
          className="flex items-center justify-between gap-3 rounded-lg border p-4"
          style={{ borderColor: "var(--color-accent)", background: "var(--color-card)" }}
        >
          <code className="font-mono text-lg tracking-wide" style={{ color: "var(--color-fg)" }}>
            {recoveryCode}
          </code>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(recoveryCode).catch(() => {})}
            className="rounded-lg border px-3 py-1.5 text-xs hover:opacity-80"
            style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
          >
            Copiar
          </button>
        </div>
        <label
          className="flex items-start gap-2 text-sm"
          style={{ color: "var(--color-fg-muted)" }}
        >
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
          />
          <span>Salvei meu código de recuperação num lugar seguro.</span>
        </label>
        <button
          type="button"
          disabled={!saved}
          onClick={() => router.refresh()}
          className="w-full rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          Entrar no diário
        </button>
      </div>
    );
  }

  if (!editable) {
    return (
      <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
        Ative o diário privado num <strong>dispositivo confiável</strong> (o celular fica só
        leitura).
      </p>
    );
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
          Ligue o <strong>diário privado</strong>: suas anotações passam a ser cifradas no seu
          aparelho. <strong>Nem nós conseguimos ler.</strong>
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          <ShieldCheck size={15} />
          Ativar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={activate} className="max-w-sm space-y-3">
      <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
        Escolha um <strong>PIN</strong> (4–8 dígitos) e redigite sua <strong>palavra-chave</strong>{" "}
        do cadastro. Vamos gerar um <strong>código de recuperação</strong> pra você salvar.
      </p>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        placeholder="PIN (4–8 dígitos)"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className={inputCls}
        style={inputStyle}
      />
      <input
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        placeholder="Confirme o PIN"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className={inputCls}
        style={inputStyle}
      />
      <input
        type="text"
        autoComplete="off"
        placeholder="Palavra-chave do cadastro"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        className={inputCls}
        style={inputStyle}
      />
      {error ? (
        <p className="text-sm" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          {busy ? "Cifrando…" : "Ativar diário privado"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border px-4 py-2 text-sm hover:opacity-80"
          style={{ borderColor: "var(--color-border)" }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
