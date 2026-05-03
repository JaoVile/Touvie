"use client";

import { GlassCard } from "@/components/glass/GlassCard";
import { useTransition, useState } from "react";
import { seedTemplates, toggleTemplate, updateTemplate, type NotificationTemplate } from "./actions";

const GROUP_LABELS: Record<string, string> = {
  "work-clock": "⏰ Ponto",
  training: "🏋️ Treino",
};

function groupKey(key: string) {
  return key.split(":")[0];
}

export function TemplatesClient({ templates }: { templates: NotificationTemplate[] }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { content: string; name: string }>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [localTemplates, setLocalTemplates] = useState(templates);

  const groups = localTemplates.reduce<Record<string, NotificationTemplate[]>>((acc, t) => {
    const g = groupKey(t.key);
    acc[g] = [...(acc[g] ?? []), t];
    return acc;
  }, {});

  function startEdit(t: NotificationTemplate) {
    setEditing(t.id);
    setDraft((d) => ({ ...d, [t.id]: { content: t.content, name: t.name } }));
  }

  function cancelEdit(id: string) {
    setEditing(null);
    setDraft((d) => { const n = { ...d }; delete n[id]; return n; });
  }

  function handleToggle(t: NotificationTemplate) {
    const newVal = !t.is_active;
    setLocalTemplates((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, is_active: newVal } : x)),
    );
    startTransition(async () => {
      await toggleTemplate(t.id, newVal);
    });
  }

  function handleSave(id: string) {
    const d = draft[id];
    if (!d) return;
    startTransition(async () => {
      await updateTemplate(id, d.content, d.name);
      setLocalTemplates((prev) =>
        prev.map((x) => (x.id === id ? { ...x, content: d.content, name: d.name } : x)),
      );
      setEditing(null);
      setFeedback("Salvo com sucesso!");
      setTimeout(() => setFeedback(null), 3000);
    });
  }

  function handleSeed() {
    startTransition(async () => {
      const result = await seedTemplates();
      if (result.created > 0) {
        setFeedback(`${result.created} template(s) criado(s). Recarregue a página.`);
      } else {
        setFeedback("Todos os templates já estão sincronizados.");
      }
      setTimeout(() => setFeedback(null), 4000);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm opacity-60">
          {localTemplates.length === 0
            ? "Nenhum template encontrado. Clique em Sincronizar para criar os padrões."
            : `${localTemplates.length} template(s) configurado(s).`}
        </p>
        <button
          type="button"
          onClick={handleSeed}
          disabled={isPending}
          className="rounded-lg px-3 py-1.5 text-sm font-medium gradient-brand text-white disabled:opacity-50"
        >
          {isPending ? "Aguarde…" : "Sincronizar padrões"}
        </button>
      </div>

      {feedback && (
        <div className="rounded-lg p-3 text-sm" style={{ background: "var(--color-surface)" }}>
          {feedback}
        </div>
      )}

      {Object.entries(groups).map(([group, items]) => (
        <GlassCard key={group}>
          <h3 className="mb-3 font-semibold">{GROUP_LABELS[group] ?? group}</h3>
          <div className="space-y-3">
            {items.map((t) => (
              <div key={t.id} className="rounded-lg p-3" style={{ background: "var(--color-surface)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {editing === t.id ? (
                      <input
                        className="w-full rounded bg-transparent border border-current/20 px-2 py-1 text-sm font-medium"
                        value={draft[t.id]?.name ?? t.name}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [t.id]: { ...d[t.id], name: e.target.value } }))
                        }
                      />
                    ) : (
                      <p className="font-medium text-sm">{t.name}</p>
                    )}
                    <p className="text-[10px] opacity-40 mt-0.5">{t.key}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggle(t)}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                        t.is_active
                          ? "bg-green-500/20 text-green-400"
                          : "bg-zinc-500/20 text-zinc-400"
                      }`}
                    >
                      {t.is_active ? "ativo" : "inativo"}
                    </button>
                    {editing === t.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSave(t.id)}
                          disabled={isPending}
                          className="rounded px-2 py-0.5 text-[10px] font-semibold gradient-brand text-white disabled:opacity-50"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelEdit(t.id)}
                          className="rounded px-2 py-0.5 text-[10px] font-semibold opacity-60 hover:opacity-80"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        className="rounded px-2 py-0.5 text-[10px] font-semibold opacity-60 hover:opacity-80"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                </div>

                {editing === t.id ? (
                  <textarea
                    className="mt-2 w-full rounded border border-current/20 bg-transparent p-2 text-xs font-mono resize-y"
                    rows={8}
                    value={draft[t.id]?.content ?? t.content}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [t.id]: { ...d[t.id], content: e.target.value } }))
                    }
                  />
                ) : (
                  <p className="mt-1 text-xs opacity-50 truncate">
                    {t.content.replace(/<[^>]+>/g, "").slice(0, 80)}…
                  </p>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      ))}

      {localTemplates.length === 0 && (
        <GlassCard>
          <p className="text-sm opacity-40 text-center py-4">
            Clique em "Sincronizar padrões" para criar os templates no banco.
          </p>
        </GlassCard>
      )}
    </div>
  );
}
