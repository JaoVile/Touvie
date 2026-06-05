"use client";

import { useRef, useState, useTransition } from "react";
import { revokeWriteHere, setWriteCode, unlockWrite } from "./actions";

type Props = {
  /** Já existe um código de acesso definido. */
  hasCode: boolean;
  /** Este dispositivo já está confiável (escrita liberada). */
  trusted: boolean;
};

export function AccessCodeForm({ hasCode, trusted }: Props) {
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  // Mostra o formulário de alterar código quando o usuário pede.
  const [changing, setChanging] = useState(false);

  function run(fn: () => Promise<{ error?: string; ok?: boolean }>, okMsg: string) {
    setError(undefined);
    setSuccess(undefined);
    start(async () => {
      const res = await fn();
      if (res?.error) {
        setError(res.error);
      } else {
        setSuccess(okMsg);
        formRef.current?.reset();
        setChanging(false);
      }
    });
  }

  // Dispositivo confiável: escrita liberada. Oferece revogar / alterar código.
  if (trusted && !changing) {
    return (
      <div className="max-w-sm space-y-3">
        <p className="text-sm" style={{ color: "var(--color-success)" }}>
          ✓ Escrita liberada neste dispositivo.
        </p>
        {success ? (
          <p className="text-sm" style={{ color: "var(--color-success)" }}>
            {success}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => revokeWriteHere(), "Acesso revogado neste dispositivo")}
            className="rounded-lg border px-4 py-1.5 text-sm hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
          >
            {pending ? "…" : "Revogar aqui"}
          </button>
          <button
            type="button"
            onClick={() => {
              setChanging(true);
              setSuccess(undefined);
              setError(undefined);
            }}
            className="rounded-lg border px-4 py-1.5 text-sm hover:opacity-80"
            style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
          >
            Alterar código
          </button>
        </div>
      </div>
    );
  }

  // Sem código ainda, ou alterando: define/altera (com confirmação).
  if (!hasCode || changing) {
    return (
      <form
        ref={formRef}
        action={(fd) =>
          run(() => setWriteCode(fd), hasCode ? "Código alterado" : "Código definido")
        }
        className="max-w-sm space-y-2"
        onChange={() => {
          if (success) setSuccess(undefined);
          if (error) setError(undefined);
        }}
      >
        {hasCode ? (
          <input
            type="password"
            name="current"
            inputMode="numeric"
            autoComplete="off"
            pattern="\d{4,8}"
            required
            placeholder="Código atual"
            className={inputCls}
            style={inputStyle}
          />
        ) : null}
        <input
          type="password"
          name="next"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{4,8}"
          required
          placeholder={hasCode ? "Novo código" : "Defina um código (4–8 dígitos)"}
          className={inputCls}
          style={inputStyle}
        />
        <input
          type="password"
          name="confirm"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{4,8}"
          required
          placeholder="Confirme o código"
          className={inputCls}
          style={inputStyle}
        />
        <Feedback error={error} success={success} />
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            {pending ? "Salvando…" : hasCode ? "Salvar" : "Definir código"}
          </button>
          {changing ? (
            <button
              type="button"
              onClick={() => {
                setChanging(false);
                setError(undefined);
              }}
              className="rounded-lg border px-4 py-2 text-sm hover:opacity-80"
              style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>
    );
  }

  // Tem código, device não confiável: digita pra liberar aqui.
  return (
    <form
      ref={formRef}
      action={(fd) => run(() => unlockWrite(fd), "Escrita liberada neste dispositivo")}
      className="max-w-sm space-y-2"
      onChange={() => {
        if (success) setSuccess(undefined);
        if (error) setError(undefined);
      }}
    >
      <input
        type="password"
        name="code"
        inputMode="numeric"
        autoComplete="off"
        pattern="\d{4,8}"
        required
        placeholder="Código de acesso"
        className={inputCls}
        style={inputStyle}
      />
      <Feedback error={error} success={success} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        {pending ? "Verificando…" : "Liberar neste dispositivo"}
      </button>
    </form>
  );
}

function Feedback({ error, success }: { error?: string; success?: string }) {
  if (error)
    return (
      <p className="text-sm" style={{ color: "var(--color-danger)" }}>
        {error}
      </p>
    );
  if (success)
    return (
      <p className="text-sm" style={{ color: "var(--color-success)" }}>
        ✓ {success}
      </p>
    );
  return null;
}

const inputCls = "w-full rounded-lg border px-3 py-2 outline-none transition focus:ring-2";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
