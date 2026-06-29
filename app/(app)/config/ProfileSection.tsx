"use client";

import { useRef, useState, useTransition } from "react";
import { updateEmail, updatePassword, updateProfileNames } from "./actions";

interface ProfileSectionProps {
  fullName: string;
  displayName: string;
  email: string;
}

/**
 * Account profile editor — three independent forms: name + nickname,
 * email (confirmation flow), and password (re-auth with the current).
 */
export function ProfileSection({ fullName, displayName, email }: ProfileSectionProps) {
  return (
    <div className="space-y-7">
      <NamesForm fullName={fullName} displayName={displayName} />
      <div className="border-t pt-6" style={{ borderColor: "var(--color-border)" }}>
        <EmailForm email={email} />
      </div>
      <div className="border-t pt-6" style={{ borderColor: "var(--color-border)" }}>
        <PasswordForm />
      </div>
    </div>
  );
}

function NamesForm({ fullName, displayName }: { fullName: string; displayName: string }) {
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    setError(undefined);
    setSuccess(false);
    start(async () => {
      try {
        const res = await updateProfileNames(fd);
        if (res?.error) setError(res.error);
        else setSuccess(true);
      } catch {
        setError(READ_ONLY_MSG);
      }
    });
  }

  return (
    <form
      action={submit}
      className="max-w-md space-y-2"
      onChange={() => {
        if (success) setSuccess(false);
        if (error) setError(undefined);
      }}
    >
      <FieldLabel>Nome</FieldLabel>
      <input
        type="text"
        name="full_name"
        defaultValue={fullName}
        maxLength={80}
        placeholder="Seu nome"
        className={inputCls}
        style={inputStyle}
      />
      <FieldLabel>Apelido — como aparece no dashboard</FieldLabel>
      <input
        type="text"
        name="display_name"
        defaultValue={displayName}
        maxLength={40}
        placeholder="Apelido"
        className={inputCls}
        style={inputStyle}
      />
      <Feedback error={error} success={success ? "✓ Perfil atualizado" : undefined} />
      <SubmitButton pending={pending}>Salvar perfil</SubmitButton>
    </form>
  );
}

function EmailForm({ email }: { email: string }) {
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    setError(undefined);
    setSuccess(false);
    start(async () => {
      try {
        const res = await updateEmail(fd);
        if (res?.error) setError(res.error);
        else setSuccess(true);
      } catch {
        setError(READ_ONLY_MSG);
      }
    });
  }

  return (
    <form
      action={submit}
      className="max-w-md space-y-2"
      onChange={() => {
        if (success) setSuccess(false);
        if (error) setError(undefined);
      }}
    >
      <FieldLabel>Email</FieldLabel>
      <input
        type="email"
        name="email"
        defaultValue={email}
        autoComplete="email"
        required
        placeholder="novo@email.com"
        className={inputCls}
        style={inputStyle}
      />
      <Feedback
        error={error}
        success={success ? "✓ Confirme o novo email — enviamos um link de verificação" : undefined}
      />
      <SubmitButton pending={pending}>Alterar email</SubmitButton>
    </form>
  );
}

function PasswordForm() {
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    setError(undefined);
    setSuccess(false);
    start(async () => {
      try {
        const res = await updatePassword(fd);
        if (res?.error) {
          setError(res.error);
        } else {
          setSuccess(true);
          formRef.current?.reset();
        }
      } catch {
        setError(READ_ONLY_MSG);
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={submit}
      className="max-w-md space-y-2"
      onChange={() => {
        if (success) setSuccess(false);
        if (error) setError(undefined);
      }}
    >
      <FieldLabel>Senha</FieldLabel>
      <input
        type="password"
        name="current"
        autoComplete="current-password"
        required
        placeholder="Senha atual"
        className={inputCls}
        style={inputStyle}
      />
      <input
        type="password"
        name="next"
        autoComplete="new-password"
        minLength={8}
        required
        placeholder="Nova senha"
        className={inputCls}
        style={inputStyle}
      />
      <input
        type="password"
        name="confirm"
        autoComplete="new-password"
        minLength={8}
        required
        placeholder="Confirme a nova senha"
        className={inputCls}
        style={inputStyle}
      />
      <Feedback error={error} success={success ? "✓ Senha alterada" : undefined} />
      <SubmitButton pending={pending}>Alterar senha</SubmitButton>
    </form>
  );
}

/* ── shared bits ─────────────────────────────────────────────── */

// Shown when a Server Action is blocked before it runs — e.g. the
// trusted-device guard returning 403. React surfaces only a generic
// transport error, so we translate it into something actionable.
const READ_ONLY_MSG =
  "Não foi possível salvar — este dispositivo pode estar em modo só-leitura. " +
  "Faça login no notebook marcando “Confiar neste dispositivo”.";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-eyebrow font-semibold uppercase tracking-[0.12em]"
      style={{ color: "var(--color-fg-subtle)" }}
    >
      {children}
    </p>
  );
}

function Feedback({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <p className="text-sm" style={{ color: "var(--color-danger)" }}>
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p className="text-sm" style={{ color: "var(--color-success)" }}>
        {success}
      </p>
    );
  }
  return null;
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
      style={{ background: "var(--gradient-brand)" }}
    >
      {pending ? "Salvando…" : children}
    </button>
  );
}

const inputCls = "w-full rounded-lg border px-3 py-2 outline-none transition focus:ring-2";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
