"use client";

import { MessageSquarePlus, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { type Message, ToubeConversation } from "./ToubeConversation";
import { createSession, deleteSession, renameSession } from "./sessions-actions";

type Session = { id: string; title: string | null; updated_at: string };

/**
 * Página do Toube com SIDEBAR de conversas (estilo ChatGPT). Cada sessão é uma
 * conversa isolada; o modelo só lê a atual. Trocar de sessão recarrega as
 * mensagens daquela conversa (GET /api/toube?session=).
 */
export function ToubeSessions({
  sessions: initialSessions,
  activeId,
  initial,
  initialSummary,
}: {
  sessions: Session[];
  activeId: string;
  initial: Message[];
  initialSummary?: string | null;
}) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [active, setActive] = useState(activeId);
  const [messages, setMessages] = useState<Message[]>(initial);
  const [summary, setSummary] = useState<string | null>(initialSummary ?? null);
  const [loading, setLoading] = useState(false);
  const [, start] = useTransition();

  async function switchTo(id: string) {
    if (id === active || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/toube?session=${id}`);
      const data = await res.json();
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setSummary(data.summary ?? null);
      setActive(id);
    } finally {
      setLoading(false);
    }
  }

  async function novaConversa() {
    if (loading) return;
    setLoading(true);
    try {
      const { id } = await createSession();
      setSessions((s) => [{ id, title: null, updated_at: new Date(0).toISOString() }, ...s]);
      setMessages([]);
      setSummary(null);
      setActive(id);
    } finally {
      setLoading(false);
    }
  }

  function rename(s: Session) {
    const novo = prompt("Renomear conversa:", s.title ?? "")?.trim();
    if (!novo) return;
    setSessions((list) => list.map((x) => (x.id === s.id ? { ...x, title: novo } : x)));
    start(() => {
      renameSession(s.id, novo);
    });
  }

  function remove(s: Session) {
    if (!confirm(`Apagar a conversa "${s.title ?? "Nova conversa"}"? Não dá pra desfazer.`)) return;
    const rest = sessions.filter((x) => x.id !== s.id);
    setSessions(rest);
    start(() => {
      deleteSession(s.id);
    });
    if (s.id === active) {
      if (rest[0]) switchTo(rest[0].id);
      else novaConversa();
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-[240px_1fr]">
      {/* Sidebar de conversas */}
      <aside className="flex flex-col gap-2">
        <button
          type="button"
          onClick={novaConversa}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          <MessageSquarePlus className="size-4" />
          Nova conversa
        </button>
        <ul className="flex max-h-[60dvh] flex-col gap-1 overflow-y-auto md:max-h-[70dvh]">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm"
              style={{
                background: s.id === active ? "var(--color-card)" : "transparent",
                border: `1px solid ${s.id === active ? "var(--color-border)" : "transparent"}`,
              }}
            >
              <button
                type="button"
                onClick={() => switchTo(s.id)}
                className="min-w-0 flex-1 truncate text-left"
                style={{ color: s.id === active ? "var(--color-fg)" : "var(--color-fg-muted)" }}
              >
                {s.title || "Nova conversa"}
              </button>
              <button
                type="button"
                onClick={() => rename(s)}
                title="Renomear"
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: "var(--color-fg-subtle)" }}
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => remove(s)}
                title="Apagar conversa"
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: "var(--color-fg-subtle)" }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Conversa ativa — key força remount limpo ao trocar */}
      <ToubeConversation
        key={active}
        initial={messages}
        variant="page"
        sessionId={active}
        summary={summary}
      />
    </div>
  );
}
