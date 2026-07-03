"use client";

import { GlassCard } from "@/components/glass/GlassCard";
import { VAR_CATALOG, isCronTemplateKey } from "@/lib/notifications/catalog";
import { useRef, useState, useTransition } from "react";
import {
  type NotificationTemplate,
  seedTemplates,
  toggleTemplate,
  updateTemplate,
} from "./actions";

const GROUP_LABELS: Record<string, string> = {
  "work-clock": "⏰ Ponto",
  training: "🏋️ Treino",
  cron: "🔔 Lembretes (cron)",
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
  const [varsOpen, setVarsOpen] = useState<string | null>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Insere {{var}} na posição atual do cursor do textarea (ou no final
  // se nada estiver focado), preservando o que já foi digitado.
  function insertVariable(templateId: string, varName: string) {
    const ta = textareaRefs.current[templateId];
    const current = draft[templateId]?.content ?? "";
    const token = `{{${varName}}}`;
    let next: string;
    let caret: number;
    if (ta && document.activeElement === ta) {
      const start = ta.selectionStart ?? current.length;
      const end = ta.selectionEnd ?? current.length;
      next = current.slice(0, start) + token + current.slice(end);
      caret = start + token.length;
    } else {
      next = current + (current.endsWith("\n") || current.length === 0 ? "" : " ") + token;
      caret = next.length;
    }
    setDraft((d) => ({ ...d, [templateId]: { ...d[templateId], content: next } }));
    // Restaura foco + posição do cursor depois do React aplicar o value.
    requestAnimationFrame(() => {
      const el = textareaRefs.current[templateId];
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

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
    setDraft((d) => {
      const n = { ...d };
      delete n[id];
      return n;
    });
  }

  function handleToggle(t: NotificationTemplate) {
    const newVal = !t.is_active;
    setLocalTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_active: newVal } : x)));
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
              <div
                key={t.id}
                className="rounded-lg p-3"
                style={{ background: "var(--color-surface)" }}
              >
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
                  <>
                    <textarea
                      ref={(el) => {
                        textareaRefs.current[t.id] = el;
                      }}
                      className="mt-2 w-full rounded border border-current/20 bg-transparent p-2 text-xs font-mono resize-y"
                      rows={isCronTemplateKey(t.key) ? 12 : 8}
                      value={draft[t.id]?.content ?? t.content}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [t.id]: { ...d[t.id], content: e.target.value } }))
                      }
                    />
                    {isCronTemplateKey(t.key) ? (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setVarsOpen((cur) => (cur === t.id ? null : t.id))}
                          aria-expanded={varsOpen === t.id}
                          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition hover:opacity-80"
                          style={{
                            background: "var(--color-card)",
                            border: "1px solid var(--color-border)",
                            color: "var(--color-accent)",
                          }}
                        >
                          <span
                            className="inline-block transition-transform"
                            style={{
                              transform: varsOpen === t.id ? "rotate(90deg)" : "rotate(0deg)",
                            }}
                          >
                            ▸
                          </span>
                          Variáveis ({VAR_CATALOG[t.key].length})
                        </button>

                        {varsOpen === t.id ? (
                          <div
                            className="mt-2 grid gap-2 rounded-lg p-2"
                            style={{
                              background: "var(--color-card)",
                              border: "1px solid var(--color-border)",
                              gridTemplateColumns: "1fr",
                            }}
                          >
                            <p className="text-[10px] uppercase tracking-[0.1em] opacity-50 px-1 pt-1">
                              Clique no nome pra inserir no cursor — exemplo abaixo mostra como
                              aparece na mensagem
                            </p>
                            {VAR_CATALOG[t.key].map((v) => (
                              <div
                                key={v.name}
                                className="rounded-md p-2"
                                style={{
                                  background: "var(--color-surface)",
                                  border: "1px solid var(--color-border)",
                                }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => insertVariable(t.id, v.name)}
                                      className="font-mono text-[12px] font-semibold transition hover:underline"
                                      style={{ color: "var(--color-accent)" }}
                                    >
                                      {`{{${v.name}}}`}
                                    </button>
                                    <p className="mt-0.5 text-[11px] opacity-70">{v.description}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => insertVariable(t.id, v.name)}
                                    className="shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold opacity-60 hover:opacity-100"
                                    title="Inserir no cursor"
                                  >
                                    + inserir
                                  </button>
                                </div>
                                <pre
                                  className="mt-1.5 whitespace-pre-wrap break-words rounded p-1.5 text-[10.5px] leading-relaxed font-mono"
                                  style={{
                                    background: "var(--color-card)",
                                    color: "var(--color-fg-muted)",
                                  }}
                                >
                                  {v.example}
                                </pre>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
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
