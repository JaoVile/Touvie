"use client";

import { ACCOUNT_KINDS, ACCOUNT_KIND_LABELS, type AccountKind } from "@/lib/finance";
import { useRef, useState, useTransition } from "react";
import { saveAccount } from "./actions";

export function AccountForm() {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<AccountKind>("checking");
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    setError(undefined);
    start(async () => {
      const res = await saveAccount(fd);
      if (res?.error) setError(res.error);
      else {
        formRef.current?.reset();
        setKind("checking");
      }
    });
  }

  const isCredit = kind === "credit";

  return (
    <form ref={formRef} action={submit} className="space-y-2 text-sm">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          type="text"
          name="name"
          required
          maxLength={60}
          placeholder="Ex: Nubank, Itaú..."
          className={inputCls}
          style={inputStyle}
        />
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as AccountKind)}
          className={inputCls}
          style={inputStyle}
        >
          {ACCOUNT_KINDS.map((k) => (
            <option key={k} value={k}>
              {ACCOUNT_KIND_LABELS[k as AccountKind]}
            </option>
          ))}
        </select>
      </div>
      <input
        type="number"
        name="balance"
        step="0.01"
        defaultValue="0"
        placeholder={isCredit ? "Saldo inicial da fatura (R$)" : "Saldo inicial (R$)"}
        className={inputCls}
        style={inputStyle}
      />
      {isCredit ? (
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            name="credit_limit"
            step="0.01"
            min="0"
            placeholder="Limite (R$)"
            className={inputCls}
            style={inputStyle}
          />
          <input
            type="number"
            name="closing_day"
            min="1"
            max="28"
            placeholder="Fecha dia"
            className={inputCls}
            style={inputStyle}
          />
          <input
            type="number"
            name="due_day"
            min="1"
            max="31"
            placeholder="Vence dia"
            className={inputCls}
            style={inputStyle}
          />
        </div>
      ) : null}
      {error ? <p style={{ color: "var(--color-danger)" }}>{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        {pending ? "Salvando…" : "Adicionar conta"}
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
