"use client";

import { useState, useTransition } from "react";
import { signupAction } from "./actions";

const inputCls = "w-full rounded-lg border px-3 py-2 outline-none transition focus:ring-2";
const inputStyle = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
} as const;

export function SignupForm() {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await signupAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="fullName" className="mb-1 block text-sm font-medium">
          Nome
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          autoComplete="name"
          placeholder="Seu nome"
          className={inputCls}
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputCls}
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputCls}
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="recovery" className="mb-1 block text-sm font-medium">
          Palavra-chave de recuperação
        </label>
        <input
          id="recovery"
          name="recovery"
          type="text"
          required
          minLength={6}
          autoComplete="off"
          placeholder="uma frase que só você sabe"
          className={inputCls}
          style={inputStyle}
        />
        <p className="mt-1 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          Guarde bem. É o único jeito de recuperar o PIN do diário se você esquecer — ninguém, nem
          nós, consegue recuperar por você.
        </p>
      </div>
      <label className="flex items-start gap-2 text-sm" style={{ color: "var(--color-fg-muted)" }}>
        <input
          type="checkbox"
          name="trustDevice"
          defaultChecked={true}
          className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
        />
        <span className="flex flex-col gap-0.5">
          <span style={{ color: "var(--color-fg)" }}>Confiar neste dispositivo</span>
          <span className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>
            Dispositivos confiáveis têm acesso completo — os demais entram em modo leitura.
          </span>
        </span>
      </label>
      {error ? (
        <p
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg px-4 py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        {pending ? "Criando conta..." : "Criar conta"}
      </button>
    </form>
  );
}
