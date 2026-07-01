"use client";

import { Reveal } from "@/components/Reveal";
import { FoldCard } from "@/components/glass/FoldCard";
import {
  type WrappedKey,
  clearSessionDEK,
  decryptEntry,
  loadSessionDEK,
} from "@/lib/diary-crypto";
import { Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DiaryEditor } from "./DiaryEditor";
import { DiaryUnlockZK } from "./DiaryUnlockZK";
import { PrivateDiaryManage } from "./PrivateDiaryManage";
import { WeekList } from "./WeekList";

interface RawEntry {
  week_start: string;
  content: string;
  updated_at: string;
  mood_score: number | null;
  mood_emoji: string | null;
}

interface Props {
  weekStart: string;
  editable: boolean;
  wraps: { pin_wrap: WrappedKey; recovery_wrap: WrappedKey; code_wrap: WrappedKey };
  entries: RawEntry[];
}

export function PrivateDiaryView({ weekStart, editable, wraps, entries }: Props) {
  const [dek, setDek] = useState<Uint8Array | null>(null);
  const [decrypted, setDecrypted] = useState<RawEntry[] | null>(null);
  const [checked, setChecked] = useState(false);
  const [showManage, setShowManage] = useState(false);

  // 1) Ao montar, tenta recuperar a DEK da sessão (aba atual).
  useEffect(() => {
    setDek(loadSessionDEK());
    setChecked(true);
  }, []);

  // 2) Com a DEK, decifra todas as anotações no navegador.
  useEffect(() => {
    if (!dek) {
      setDecrypted(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const out = await Promise.all(
          entries.map(async (e) => ({ ...e, content: await decryptEntry(e.content, dek) })),
        );
        if (!cancelled) setDecrypted(out);
      } catch {
        // DEK não bate com estes dados (ex.: trocou de conta) — força novo unlock.
        if (!cancelled) {
          clearSessionDEK();
          setDek(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dek, entries]);

  if (!checked) return null;
  if (!dek) return <DiaryUnlockZK wraps={wraps} onUnlock={setDek} />;
  if (decrypted === null) {
    return (
      <p className="py-6 text-center text-sm" style={{ color: "var(--color-fg-muted)" }}>
        Decifrando…
      </p>
    );
  }

  const current = decrypted.find((e) => e.week_start === weekStart) ?? null;
  const past = decrypted.filter((e) => e.week_start !== weekStart);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Reveal className="h-full">
          <DiaryEditor
            weekStart={weekStart}
            initialContent={current?.content ?? ""}
            initialSavedAt={current?.updated_at ?? null}
            initialMoodScore={current?.mood_score ?? null}
            initialMoodEmoji={current?.mood_emoji ?? null}
            editable={editable}
            dek={dek}
          />
        </Reveal>
        <Reveal className="h-full" delay={80}>
          <WeekList currentWeekStart={weekStart} entries={past} />
        </Reveal>
      </div>

      {editable ? (
        <div className="mt-4">
          <FoldCard>
            <button
              type="button"
              onClick={() => setShowManage((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <Settings2 size={16} style={{ color: "var(--color-fg-muted)" }} />
              Gerenciar diário privado
            </button>
            {showManage ? (
              <div className="mt-4">
                <PrivateDiaryManage
                  dek={dek}
                  entries={decrypted.map((e) => ({ week_start: e.week_start, content: e.content }))}
                />
              </div>
            ) : null}
          </FoldCard>
        </div>
      ) : null}
    </>
  );
}
