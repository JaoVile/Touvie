"use client";

import { GlassCard } from "@/components/glass/GlassCard";
import { addWeeks, weekRangeLabelBR, weekStartISO } from "@/lib/datetime";
import { clearSessionDEK, encryptEntry } from "@/lib/diary-crypto";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveEntry, saveMood } from "./actions";

interface Props {
  weekStart: string;
  initialContent: string;
  initialSavedAt: string | null;
  initialMoodScore: number | null;
  initialMoodEmoji: string | null;
  editable: boolean;
  /** Presente = diário privado: cifra o texto no navegador antes de salvar. */
  dek?: Uint8Array | null;
}

type Status =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "error"; message: string };

const MOODS: { score: number; emoji: string; label: string }[] = [
  { score: 1, emoji: "😞", label: "Muito mal" },
  { score: 2, emoji: "😕", label: "Mal" },
  { score: 3, emoji: "😐", label: "Neutro" },
  { score: 4, emoji: "🙂", label: "Bem" },
  { score: 5, emoji: "😄", label: "Ótimo" },
];

const AUTOSAVE_DEBOUNCE_MS = 1200;

export function DiaryEditor({
  weekStart,
  initialContent,
  initialSavedAt,
  initialMoodScore,
  initialMoodEmoji,
  editable,
  dek,
}: Props) {
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState<Status>(
    initialSavedAt ? { kind: "saved", at: initialSavedAt } : { kind: "idle" },
  );
  const [moodScore, setMoodScore] = useState<number | null>(initialMoodScore);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    setContent(initialContent);
    setStatus(initialSavedAt ? { kind: "saved", at: initialSavedAt } : { kind: "idle" });
    setMoodScore(initialMoodScore);
  }, [weekStart, initialContent, initialSavedAt, initialMoodScore]);

  async function flush(text: string) {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setStatus({ kind: "saving" });
    try {
      // Diário privado: cifra no navegador antes de subir (o servidor só vê ciphertext).
      const content = dek ? await encryptEntry(text, dek) : text;
      const res = await saveEntry({ week_start: weekStart, content });
      if (res?.error) setStatus({ kind: "error", message: res.error });
      else setStatus({ kind: "saved", at: res.saved_at ?? new Date().toISOString() });
    } catch {
      setStatus({ kind: "error", message: "Erro ao salvar" });
    }
  }

  function onChange(value: string) {
    setContent(value);
    if (!editable) return;
    setStatus({ kind: "dirty" });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(value), AUTOSAVE_DEBOUNCE_MS);
  }

  function handleMood(score: number, emoji: string) {
    if (!editable) return;
    setMoodScore(score);
    saveMood({ week_start: weekStart, mood_score: score, mood_emoji: emoji });
  }

  useEffect(() => {
    function onBeforeUnload() {
      if (timer.current && editable) {
        clearTimeout(timer.current);
        // Best-effort. No modo privado a cifra é assíncrona e pode não terminar
        // ao fechar; o autosave (1,2s) cobre o caso normal.
        if (dek)
          encryptEntry(content, dek).then((c) => saveEntry({ week_start: weekStart, content: c }));
        else saveEntry({ week_start: weekStart, content });
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [content, weekStart, editable, dek]);

  async function lockNow() {
    if (timer.current && editable) await flush(content);
    if (dek) {
      // Diário privado: trancar = esquecer a DEK desta sessão (re-pede PIN).
      clearSessionDEK();
    } else {
      await fetch("/api/diary/lock", { method: "POST" });
    }
    router.refresh();
  }

  const today = weekStartISO();
  const prev = addWeeks(weekStart, -1);
  const next = addWeeks(weekStart, 1);
  const isFuture = next > today;
  const isCurrent = weekStart === today;

  return (
    <GlassCard>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Link
            href={`/diario?w=${prev}`}
            className="rounded px-2 py-1 text-sm transition hover:opacity-80"
            style={{ background: "var(--color-card)" }}
            aria-label="Semana anterior"
          >
            ←
          </Link>
          {isFuture ? (
            <span
              className="rounded px-2 py-1 text-sm opacity-40"
              style={{ background: "var(--color-card)" }}
              aria-label="Sem semana posterior"
            >
              →
            </span>
          ) : (
            <Link
              href={`/diario?w=${next}`}
              className="rounded px-2 py-1 text-sm transition hover:opacity-80"
              style={{ background: "var(--color-card)" }}
              aria-label="Próxima semana"
            >
              →
            </Link>
          )}
          <span className="ml-2 text-sm" style={{ color: "var(--color-fg-muted)" }}>
            {weekRangeLabelBR(weekStart)}
          </span>
          {isCurrent ? (
            <span
              className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              esta semana
            </span>
          ) : null}
        </div>
        {dek ? (
          <button
            type="button"
            onClick={lockNow}
            className="btn-chip text-eyebrow font-semibold uppercase tracking-[0.1em]"
            title="Trancar o diário agora"
          >
            <Lock size={12} strokeWidth={2.25} />
            Trancar
          </button>
        ) : null}
      </div>

      {/* Mood picker */}
      <div className="mb-3 flex items-center gap-1.5">
        <span className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          Humor:
        </span>
        {MOODS.map((m) => (
          <button
            key={m.score}
            type="button"
            disabled={!editable}
            onClick={() => handleMood(m.score, m.emoji)}
            title={m.label}
            aria-pressed={moodScore === m.score}
            className="mood-btn"
            data-selected={moodScore === m.score || undefined}
          >
            {m.emoji}
          </button>
        ))}
        {moodScore ? (
          <span className="ml-1 text-xs" style={{ color: "var(--color-fg-muted)" }}>
            {MOODS.find((m) => m.score === moodScore)?.label}
          </span>
        ) : null}
      </div>

      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        readOnly={!editable}
        spellCheck
        placeholder={
          editable
            ? "Escreva como se já tivesse acontecido. Use o presente. Sinta antes de pensar."
            : "Somente leitura."
        }
        className="min-h-[440px] w-full resize-y rounded-lg border p-4 font-mono text-sm leading-relaxed outline-none transition focus:ring-2"
        style={{
          background: "var(--color-card)",
          borderColor: "var(--color-border)",
          color: "var(--color-fg)",
        }}
      />

      <div className="mt-2 flex items-center justify-between text-xs">
        <span style={{ color: "var(--color-fg-subtle)" }}>{wordCount(content)} palavras</span>
        <span style={{ color: statusColor(status) }}>{statusLabel(status, editable)}</span>
      </div>
    </GlassCard>
  );
}

function wordCount(s: string): number {
  const trimmed = s.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function statusLabel(s: Status, editable: boolean): string {
  if (!editable) return "modo leitura";
  switch (s.kind) {
    case "idle":
      return "—";
    case "dirty":
      return "alterado";
    case "saving":
      return "salvando…";
    case "saved":
      return `salvo às ${formatTime(s.at)}`;
    case "error":
      return `erro: ${s.message}`;
  }
}

function statusColor(s: Status): string {
  switch (s.kind) {
    case "saved":
      return "var(--color-success)";
    case "error":
      return "var(--color-danger)";
    case "saving":
      return "var(--color-accent)";
    default:
      return "var(--color-fg-subtle)";
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
