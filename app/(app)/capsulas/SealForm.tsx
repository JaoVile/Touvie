"use client";

import { encryptEntry, loadSessionDEK } from "@/lib/diary-crypto";
import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sealCapsule } from "./actions";

interface Props {
  editable: boolean;
  /** Diário privado (zero-knowledge) está ligado? */
  zkOn: boolean;
}

const DURATIONS = [
  { key: "1w", label: "1 semana" },
  { key: "1m", label: "1 mês" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "1y", label: "1 ano" },
  { key: "custom", label: "Data exata" },
] as const;
type DurationKey = (typeof DURATIONS)[number]["key"];

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const inputCls = "w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};

function computeOpensAt(key: DurationKey, customDate: string): Date | null {
  const d = new Date();
  switch (key) {
    case "1w":
      d.setDate(d.getDate() + 7);
      return d;
    case "1m":
      d.setMonth(d.getMonth() + 1);
      return d;
    case "3m":
      d.setMonth(d.getMonth() + 3);
      return d;
    case "6m":
      d.setMonth(d.getMonth() + 6);
      return d;
    case "1y":
      d.setFullYear(d.getFullYear() + 1);
      return d;
    case "custom": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(customDate)) return null;
      // Abre às 09:00 locais do dia escolhido (casa com o aviso da manhã).
      const c = new Date(`${customDate}T09:00:00`);
      return Number.isNaN(c.getTime()) ? null : c;
    }
  }
}

export function SealForm({ editable, zkOn }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [duration, setDuration] = useState<DurationKey>("3m");
  const [customDate, setCustomDate] = useState("");
  const [confirming, setConfirming] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [done, setDone] = useState<string>();
  const [hasDek, setHasDek] = useState(false);

  // sessionStorage só existe no cliente — sonda depois de montar.
  useEffect(() => {
    setHasDek(!!loadSessionDEK());
  }, []);

  const willEncrypt = zkOn && hasDek;

  if (!editable) {
    return (
      <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
        Este dispositivo é só leitura — sele suas cartas num dispositivo confiável.
      </p>
    );
  }

  function askConfirm(e: React.FormEvent) {
    e.preventDefault();
    setErr(undefined);
    setDone(undefined);
    if (!content.trim()) return setErr("Escreva a carta antes de selar.");
    const opens = computeOpensAt(duration, customDate);
    if (!opens) return setErr("Escolha uma data válida.");
    if (opens.getTime() <= Date.now() + 60_000) return setErr("A data precisa estar no futuro.");
    setConfirming(opens);
  }

  async function seal() {
    if (!confirming) return;
    setBusy(true);
    setErr(undefined);
    try {
      let payload = content;
      if (willEncrypt) {
        const dek = loadSessionDEK();
        if (!dek) {
          setErr("O diário trancou no meio do caminho — destranque e tente de novo.");
          setBusy(false);
          return;
        }
        payload = await encryptEntry(content, dek);
      }
      const res = await sealCapsule({
        title,
        content: payload,
        opensAt: confirming.toISOString(),
      });
      if (res.error) {
        setErr(res.error);
        setBusy(false);
        return;
      }
      setDone(`Jogada pro universo. Volta em ${dateFmt.format(confirming)}.`);
      setTitle("");
      setContent("");
      setConfirming(null);
      setBusy(false);
      router.refresh();
    } catch {
      setErr("Falha ao selar. Tente de novo.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={askConfirm} className="space-y-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        placeholder="Título (fica visível enquanto viaja — a carta não)"
        className={inputCls}
        style={inputStyle}
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={6}
        maxLength={100_000}
        placeholder="A carta. Pro futuro, pra Deus, pro universo — pra você."
        className={`${inputCls} resize-y`}
        style={inputStyle}
      />
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor="capsule-duration"
          className="text-sm"
          style={{ color: "var(--color-fg-muted)" }}
        >
          Volta em
        </label>
        <select
          id="capsule-duration"
          value={duration}
          onChange={(e) => setDuration(e.target.value as DurationKey)}
          className="rounded-lg border px-3 py-2 text-sm outline-none"
          style={inputStyle}
        >
          {DURATIONS.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
        {duration === "custom" ? (
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        ) : null}
      </div>

      {willEncrypt ? (
        <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-fg-muted)" }}>
          <LockKeyhole size={13} style={{ color: "var(--color-accent)" }} />
          Vai selada cifrada com a chave do seu diário — nem o servidor lê.
        </p>
      ) : zkOn ? (
        <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
          Seu diário está trancado — destrancando ele antes, a carta vai cifrada. Assim, vai sem
          cifra (a trava de tempo vale igual).
        </p>
      ) : null}

      {err ? (
        <p className="text-sm" style={{ color: "var(--color-danger)" }}>
          {err}
        </p>
      ) : null}
      {done ? (
        <p className="text-sm" style={{ color: "var(--color-success)" }}>
          {done}
        </p>
      ) : null}

      {confirming ? (
        <div
          className="space-y-2 rounded-lg border p-3"
          style={{ borderColor: "var(--color-border)" }}
        >
          <p className="text-sm">
            Depois de selar, ninguém abre antes de <strong>{dateFmt.format(confirming)}</strong> —
            nem você.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={seal}
              className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--gradient-brand)" }}
            >
              {busy ? "Selando…" : "Jogar pro universo"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(null)}
              className="rounded-lg border px-4 py-1.5 text-sm hover:opacity-80"
              style={{ borderColor: "var(--color-border)" }}
            >
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="submit"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          Selar
        </button>
      )}
    </form>
  );
}
