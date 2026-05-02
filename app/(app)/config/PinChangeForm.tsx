"use client";

import { useRef, useState, useTransition } from "react";
import { changePin } from "./actions";

export function PinChangeForm() {
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    setError(undefined);
    setSuccess(false);
    start(async () => {
      const res = await changePin(fd);
      if (res?.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        formRef.current?.reset();
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={submit}
      className="max-w-sm space-y-2"
      onChange={() => {
        if (success) setSuccess(false);
        if (error) setError(undefined);
      }}
    >
      <input
        type="password"
        name="current"
        inputMode="numeric"
        autoComplete="current-password"
        pattern="\d{4,8}"
        required
        placeholder="PIN atual"
        className={inputCls}
        style={inputStyle}
      />
      <input
        type="password"
        name="next"
        inputMode="numeric"
        autoComplete="new-password"
        pattern="\d{4,8}"
        required
        placeholder="Novo PIN"
        className={inputCls}
        style={inputStyle}
      />
      <input
        type="password"
        name="confirm"
        inputMode="numeric"
        autoComplete="new-password"
        pattern="\d{4,8}"
        required
        placeholder="Confirme novo PIN"
        className={inputCls}
        style={inputStyle}
      />
      {error ? (
        <p className="text-sm" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm" style={{ color: "var(--color-success)" }}>
          ✓ PIN alterado
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        {pending ? "Salvando…" : "Alterar PIN"}
      </button>
    </form>
  );
}

const inputCls = "w-full rounded-lg border px-3 py-2 outline-none transition focus:ring-2";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
