"use client";

import { ACCOUNT_KINDS, ACCOUNT_KIND_LABELS, type AccountKind } from "@/lib/finance";
import {
  Banknote,
  ChevronDown,
  CreditCard,
  Landmark,
  type LucideIcon,
  PiggyBank,
  TrendingUp,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { saveAccount } from "./actions";

const KIND_ICONS: Record<AccountKind, LucideIcon> = {
  cash: Banknote,
  checking: Landmark,
  savings: PiggyBank,
  credit: CreditCard,
  investment: TrendingUp,
};

// Atalhos pros casos mais comuns no Brasil: um toque preenche nome + tipo, pra
// quem está começando não precisar pensar em "qual tipo de conta é essa".
const BANK_SHORTCUTS: Array<{ label: string; name: string; kind: AccountKind }> = [
  { label: "Nubank", name: "Nubank", kind: "checking" },
  { label: "Mercado Pago", name: "Mercado Pago", kind: "checking" },
  { label: "Inter", name: "Inter", kind: "checking" },
  { label: "Caixa", name: "Caixa", kind: "checking" },
  { label: "Itaú", name: "Itaú", kind: "checking" },
  { label: "Nubank Cartão", name: "Nubank Cartão", kind: "credit" },
  { label: "Dinheiro", name: "Dinheiro", kind: "cash" },
];

export function AccountForm() {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<AccountKind>("checking");
  const [name, setName] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function reset() {
    formRef.current?.reset();
    setKind("checking");
    setName("");
    setShowAdvanced(false);
  }

  function submit(fd: FormData) {
    setError(undefined);
    start(async () => {
      const res = await saveAccount(fd);
      if (res?.error) setError(res.error);
      else reset();
    });
  }

  function applyShortcut(s: (typeof BANK_SHORTCUTS)[number]) {
    setName(s.name);
    setKind(s.kind);
    // Cartão precisa dos campos extras (limite/fechamento) — já abre o avançado.
    if (s.kind === "credit") setShowAdvanced(true);
  }

  const isCredit = kind === "credit";

  return (
    <form ref={formRef} action={submit} className="space-y-3 text-sm">
      {/* Atalhos de banco */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {BANK_SHORTCUTS.map((s) => {
          const Icon = KIND_ICONS[s.kind];
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => applyShortcut(s)}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition hover:opacity-80"
              style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
            >
              <Icon size={12} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Nome + saldo (sempre visíveis) */}
      <input
        type="text"
        name="name"
        required
        maxLength={60}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome da conta (ex: Nubank)"
        className={inputCls}
        style={inputStyle}
      />
      <input
        type="number"
        name="balance"
        step="0.01"
        defaultValue="0"
        placeholder={isCredit ? "Saldo inicial da fatura (R$)" : "Saldo atual (R$)"}
        className={inputCls}
        style={inputStyle}
      />

      {/* tipo vai junto no submit mesmo quando o avançado está fechado */}
      <input type="hidden" name="kind" value={kind} />

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium transition hover:opacity-80"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        <ChevronDown
          size={13}
          style={{
            transform: showAdvanced ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
        {showAdvanced ? "Menos opções" : "Mais opções"}
      </button>

      {showAdvanced ? (
        <div className="space-y-2">
          {/* Picker visual de tipo */}
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {ACCOUNT_KINDS.map((k) => {
              const Icon = KIND_ICONS[k];
              const active = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className="flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[10px] font-medium transition"
                  style={{
                    borderColor: active ? "var(--color-accent)" : "var(--color-border)",
                    background: active ? "var(--color-accent)" : "transparent",
                    color: active ? "white" : "var(--color-fg-muted)",
                  }}
                >
                  <Icon size={16} />
                  {ACCOUNT_KIND_LABELS[k]}
                </button>
              );
            })}
          </div>

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
