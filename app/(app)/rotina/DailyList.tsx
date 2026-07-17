"use client";

import { useOptimistic, useState, useTransition } from "react";
import { DailyForm } from "./DailyForm";
import { deleteDailyBlock, toggleCompletion } from "./actions";

interface Block {
  id: string;
  time_slot: string;
  title: string;
  emoji: string | null;
  notes: string | null;
}

interface Props {
  blocks: Block[];
  completedToday: string[];
  streaks: Record<string, number>;
  todayISO: string;
}

export function DailyList({ blocks, completedToday, streaks, todayISO }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Estado OTIMISTA derivado do servidor (`completedToday`) + toggles pendentes.
  // A marcação aparece na hora; quando a action revalida, o React reconcilia com
  // a verdade do servidor sozinho (e reverte se falhar). Sem travar o botão →
  // dá pra marcar vários hábitos em sequência sem esperar cada ida ao servidor.
  const [optimisticDone, toggleOptimistic] = useOptimistic(
    new Set(completedToday),
    (prev, id: string) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    },
  );

  function handleToggle(id: string) {
    start(async () => {
      toggleOptimistic(id); // instantâneo, ANTES do await (senão perde o efeito)
      await toggleCompletion(id, todayISO);
    });
  }

  if (blocks.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
        Nenhum bloco ainda — adiciona o primeiro ao lado.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {blocks.map((b) => {
        const done = optimisticDone.has(b.id);
        const streak = streaks[b.id] ?? 0;

        return (
          <li key={b.id}>
            {editing === b.id ? (
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-border)" }}>
                <DailyForm defaultValues={b} onDone={() => setEditing(null)} />
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="mt-2 w-full text-xs"
                  style={{ color: "var(--color-fg-muted)" }}
                >
                  cancelar
                </button>
              </div>
            ) : (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors"
                style={{
                  background: done ? "var(--color-card)" : "var(--color-card)",
                  borderColor: done ? "var(--color-success)" : "var(--color-border)",
                  opacity: done ? 0.75 : 1,
                }}
              >
                <button
                  type="button"
                  onClick={() => handleToggle(b.id)}
                  className="shrink-0 text-lg leading-none transition-transform active:scale-90"
                  aria-label={done ? "Desmarcar" : "Marcar como feito"}
                >
                  {done ? "✅" : "⬜"}
                </button>

                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="font-mono text-xs" style={{ color: "var(--color-fg-subtle)" }}>
                    {b.time_slot.slice(0, 5)}
                  </span>
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-medium"
                      style={{ textDecoration: done ? "line-through" : "none" }}
                    >
                      {b.emoji ? <span className="mr-1.5">{b.emoji}</span> : null}
                      {b.title}
                    </p>
                    {b.notes ? (
                      <p className="truncate text-xs" style={{ color: "var(--color-fg-muted)" }}>
                        {b.notes}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {streak > 0 ? (
                    <span className="text-xs font-semibold" title={`${streak} dias seguidos`}>
                      🔥 {streak}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setEditing(b.id)}
                    className="rounded px-2 py-1 text-xs"
                    style={{ color: "var(--color-accent)" }}
                  >
                    editar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm("Apagar esse bloco?")) return;
                      start(() => deleteDailyBlock(b.id));
                    }}
                    className="rounded px-2 py-1 text-xs"
                    style={{ color: "var(--color-danger)" }}
                  >
                    apagar
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
