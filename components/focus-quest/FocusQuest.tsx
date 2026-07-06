"use client";

import {
  type QuestRow,
  completeQuest,
  createQuest,
  discardQuest,
} from "@/components/focus-quest/actions";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

/** Sorteia um item estável (só muda quando `seed` muda). */
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

export function FocusQuest({ initial }: { initial: QuestRow | null }) {
  const t = useTranslations("focoDoDia");
  const [quest, setQuest] = useState<QuestRow | null>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Sorteio estável por montagem (Math.random é aceitável no client).
  const seed = useMemo(() => Math.floor(Math.random() * 1000), []);
  const affirmations = t.raw("affirmations") as string[];
  const questions = t.raw("questions") as string[];
  const congrats = t.raw("congrats") as string[];
  const affirmation = pick(affirmations, seed);
  const question = pick(questions, seed);

  /** Duração "amigável" entre dois ISO. Skew negativo → durLessMin. */
  function durationLabel(startISO: string, endISO: string): string {
    const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
    const min = Math.round(ms / 60000);
    if (min < 1) return t("durLessMin");
    if (min < 60) return t("durMin", { min });
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? t("durHour", { h }) : t("durHourMin", { h, min: m });
  }

  if (dismissed) return null;

  const phase = !quest ? "invite" : quest.completed_at ? "done" : "active";

  async function onCreate() {
    if (!text.trim() || busy) return;
    setBusy(true);
    const res = await createQuest(text, question);
    setBusy(false);
    if (res.ok && res.quest) {
      setQuest(res.quest);
      setText("");
    }
  }

  async function onFinish() {
    if (!quest || busy) return;
    setBusy(true);
    const res = await completeQuest(quest.id);
    setBusy(false);
    if (res.ok && res.quest) setQuest(res.quest);
  }

  async function onDiscard() {
    if (!quest || busy) return;
    setBusy(true);
    const res = await discardQuest(quest.id);
    setBusy(false);
    if (res.ok) setQuest(null); // volta ao convite
  }

  return (
    <aside
      className={cn(
        "fixed bottom-24 right-4 z-40 w-[min(20rem,calc(100vw-2rem))]",
        "rounded-2xl border p-4 shadow-lg backdrop-blur",
      )}
      style={{
        background: "color-mix(in srgb, var(--color-card) 82%, transparent)",
        borderColor: "var(--color-border)",
      }}
    >
      {phase === "invite" && (
        <div className="grid gap-3">
          <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
            {affirmation}
          </p>
          <p className="font-semibold">{question}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder={t("placeholder")}
            className="w-full resize-none rounded-lg border bg-transparent p-2 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
          <button
            type="button"
            onClick={onCreate}
            disabled={busy || !text.trim()}
            className="rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
          >
            {t("create")}
          </button>
        </div>
      )}

      {phase === "active" && quest && (
        <div className="grid gap-3">
          <p className="text-xs uppercase tracking-wide" style={{ color: "var(--color-fg-muted)" }}>
            {t("title")}
          </p>
          <p className="font-semibold">{quest.text}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFinish}
              disabled={busy}
              className="rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50"
              style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
            >
              {t("finish")}
            </button>
            <button
              type="button"
              onClick={onDiscard}
              disabled={busy}
              className="text-xs underline opacity-70 transition hover:opacity-100"
            >
              {t("discard")}
            </button>
          </div>
        </div>
      )}

      {phase === "done" && quest?.completed_at && (
        <div className="grid gap-3">
          <p className="text-sm font-medium">
            {pick(congrats, seed).replace(
              "{duration}",
              durationLabel(quest.started_at, quest.completed_at),
            )}
          </p>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="justify-self-start text-xs underline opacity-70 transition hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}
    </aside>
  );
}
