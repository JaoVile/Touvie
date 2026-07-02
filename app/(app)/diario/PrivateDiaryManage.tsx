"use client";

import { clearSessionDEK, decryptEntry, wrapDEK } from "@/lib/diary-crypto";
import { KeyRound, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  deactivatePrivateDiary,
  listEncryptedCapsules,
  updateDiaryPinWrap,
} from "./crypto-actions";

interface Props {
  dek: Uint8Array;
  /** Anotações JÁ decifradas (texto puro) — usadas ao desligar. */
  entries: { week_start: string; content: string }[];
}

const inputCls = "w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};

export function PrivateDiaryManage({ dek, entries }: Props) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string }>();
  const [busy, setBusy] = useState(false);
  const [confirmingOff, setConfirmingOff] = useState(false);

  async function changePin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(undefined);
    if (!/^\d{4,8}$/.test(pin)) return setMsg({ kind: "err", text: "PIN deve ter 4 a 8 dígitos." });
    if (pin !== confirm) return setMsg({ kind: "err", text: "Os PINs não conferem." });
    setBusy(true);
    try {
      const pin_wrap = await wrapDEK(dek, pin);
      const res = await updateDiaryPinWrap(pin_wrap);
      if (res.error) setMsg({ kind: "err", text: res.error });
      else {
        setMsg({ kind: "ok", text: "PIN atualizado." });
        setPin("");
        setConfirm("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function disablePrivate() {
    setMsg(undefined);
    setBusy(true);
    try {
      // Cápsulas do tempo cifradas usam a MESMA DEK — decifra em memória (sem
      // exibir) antes de apagar as chaves, senão viram cartas perdidas pra sempre.
      const listed = await listEncryptedCapsules();
      if (listed.error) {
        setMsg({ kind: "err", text: listed.error });
        setBusy(false);
        return;
      }
      const capsules: { id: string; content: string }[] = [];
      for (const c of listed.capsules ?? []) {
        try {
          capsules.push({ id: c.id, content: await decryptEntry(c.content, dek) });
        } catch {
          setMsg({
            kind: "err",
            text: "Não consegui decifrar uma cápsula do tempo — desligamento abortado pra não perder a carta.",
          });
          setBusy(false);
          return;
        }
      }
      const res = await deactivatePrivateDiary(entries, capsules);
      if (res.error) {
        setMsg({ kind: "err", text: res.error });
        setBusy(false);
        return;
      }
      clearSessionDEK();
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Falha ao desligar." });
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={changePin} className="max-w-sm space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound size={15} style={{ color: "var(--color-accent)" }} />
          Trocar PIN
        </div>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          placeholder="Novo PIN (4–8 dígitos)"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className={inputCls}
          style={inputStyle}
        />
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          placeholder="Confirme o novo PIN"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputCls}
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          {busy ? "Salvando…" : "Salvar PIN"}
        </button>
      </form>

      {msg ? (
        <p
          className="text-sm"
          style={{ color: msg.kind === "ok" ? "var(--color-success)" : "var(--color-danger)" }}
        >
          {msg.text}
        </p>
      ) : null}

      <div className="border-t pt-4" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldOff size={15} style={{ color: "var(--color-danger)" }} />
          Desligar diário privado
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--color-fg-muted)" }}>
          Volta suas anotações — e as cápsulas do tempo cifradas — pra texto normal (legível) e
          remove a cifra. Você pode religar depois.
        </p>
        {confirmingOff ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={disablePrivate}
              className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--color-danger)" }}
            >
              {busy ? "Desligando…" : "Confirmar desligar"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingOff(false)}
              className="rounded-lg border px-4 py-1.5 text-sm hover:opacity-80"
              style={{ borderColor: "var(--color-border)" }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingOff(true)}
            className="mt-2 rounded-lg border px-4 py-1.5 text-sm hover:opacity-80"
            style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
          >
            Desligar
          </button>
        )}
      </div>
    </div>
  );
}
