"use client";

import {
  type ReminderRow,
  deleteReminder,
  listAllReminders,
  toggleReminder,
} from "@/components/reminders/actions";
import { describeSchedule } from "@/lib/reminders";
import {
  Bell,
  BookOpen,
  Bot,
  Dumbbell,
  type LucideIcon,
  NotebookPen,
  Salad,
  Trash2,
  Wallet,
} from "lucide-react";
import { type CSSProperties, useState, useTransition } from "react";

const cardStyle: CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
};

/** area → rótulo + ícone amigável (fallback capitaliza a área crua). */
const AREA_META: Record<string, { label: string; icon: LucideIcon }> = {
  toube: { label: "Assistente", icon: Bot },
  dieta: { label: "Dieta", icon: Salad },
  treino: { label: "Treino", icon: Dumbbell },
  financas: { label: "Finanças", icon: Wallet },
  notas: { label: "Notas", icon: NotebookPen },
  leitura: { label: "Leitura", icon: BookOpen },
};

function areaMeta(area: string): { label: string; icon: LucideIcon } {
  return AREA_META[area] ?? { label: area.charAt(0).toUpperCase() + area.slice(1), icon: Bell };
}

export function RemindersClient({
  initial,
  loadError,
}: {
  initial: ReminderRow[];
  loadError: string | null;
}) {
  const [reminders, setReminders] = useState<ReminderRow[]>(initial);
  const [error, setError] = useState<string | null>(loadError);
  const [mutating, startMutate] = useTransition();

  async function reload() {
    const res = await listAllReminders();
    if (res.ok) {
      setReminders(res.reminders ?? []);
      setError(null);
    } else {
      setError(res.error ?? "Erro ao carregar.");
    }
  }

  function toggleActive(id: string, active: boolean) {
    startMutate(async () => {
      await toggleReminder(id, !active);
      await reload();
    });
  }

  function remove(id: string) {
    startMutate(async () => {
      await deleteReminder(id);
      await reload();
    });
  }

  return (
    <div className="rounded-2xl border p-5" style={cardStyle}>
      <h3
        className="mb-4 text-label font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--color-fg)" }}
      >
        Seus lembretes
        {reminders.length > 0 ? (
          <span style={{ color: "var(--color-fg-subtle)" }}> · {reminders.length}</span>
        ) : null}
      </h3>

      {error ? (
        <p className="text-sm" style={{ color: "var(--color-danger)" }}>
          ⚠️ {error}
        </p>
      ) : reminders.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-fg-subtle)" }}>
          Nenhum lembrete agendado. Peça ao Toube ("me lembra às 18h de…") ou crie na aba Lembretes
          da dieta.
        </p>
      ) : (
        <ul className="space-y-2">
          {reminders.map((r) => {
            const meta = areaMeta(r.area);
            const Icon = meta.icon;
            return (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
                style={{ borderColor: "var(--color-border)", opacity: r.active ? 1 : 0.55 }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        borderColor: "var(--color-border)",
                        color: "var(--color-fg-subtle)",
                      }}
                    >
                      <Icon size={11} strokeWidth={2} />
                      {meta.label}
                    </span>
                  </div>
                  <p
                    className="mt-1 truncate text-sm font-medium"
                    style={{ color: "var(--color-fg)" }}
                  >
                    {r.message}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
                    {describeSchedule(r.schedule)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(r.id, r.active)}
                    disabled={mutating}
                    className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:opacity-50"
                    style={{
                      borderColor: r.active
                        ? "color-mix(in srgb, var(--color-success) 50%, transparent)"
                        : "var(--color-border)",
                      color: r.active ? "var(--color-success)" : "var(--color-fg-subtle)",
                    }}
                  >
                    {r.active ? "ativo" : "pausado"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    disabled={mutating}
                    aria-label="Excluir lembrete"
                    className="rounded-lg p-1.5 transition hover:opacity-70 disabled:opacity-50"
                    style={{ color: "var(--color-fg-subtle)" }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
