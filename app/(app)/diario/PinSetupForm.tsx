"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setupPin } from "./actions";

export function PinSetupForm() {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(fd: FormData) {
    setError(undefined);
    start(async () => {
      const res = await setupPin(fd);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-3 max-w-sm">
      <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
        Escolha um PIN de 4 a 8 dígitos. Você usa ele pra abrir o diário em qualquer dispositivo —
        ele continua válido por 30 minutos depois de desbloquear.
      </p>
      <input
        type="password"
        name="pin"
        inputMode="numeric"
        autoComplete="new-password"
        pattern="\d{4,8}"
        minLength={4}
        maxLength={8}
        required
        // biome-ignore lint/a11y/noAutofocus: foco imediato no campo de PIN ao abrir o formulário é o comportamento desejado
        autoFocus
        placeholder="PIN (4–8 dígitos)"
        className={inputCls}
        style={inputStyle}
      />
      <input
        type="password"
        name="confirm"
        inputMode="numeric"
        autoComplete="new-password"
        pattern="\d{4,8}"
        minLength={4}
        maxLength={8}
        required
        placeholder="Confirme o PIN"
        className={inputCls}
        style={inputStyle}
      />
      {error ? (
        <p className="text-sm" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        {pending ? "Configurando…" : "Definir PIN"}
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
