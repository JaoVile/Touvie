"use client";

import { useState, useTransition } from "react";
import { loginAction } from "./actions";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [error, setError] = useState<string | undefined>(initialError);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
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
          className="w-full rounded-lg border px-3 py-2 outline-none transition focus:ring-2"
          style={{
            background: "var(--color-card)",
            borderColor: "var(--color-border)",
            color: "var(--color-fg)",
          }}
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
          autoComplete="current-password"
          className="w-full rounded-lg border px-3 py-2 outline-none transition focus:ring-2"
          style={{
            background: "var(--color-card)",
            borderColor: "var(--color-border)",
            color: "var(--color-fg)",
          }}
        />
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
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
