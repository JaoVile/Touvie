"use client";

import type { Message } from "@/app/(app)/toube/ToubeConversation";
import { createSession, deleteSession } from "@/app/(app)/toube/sessions-actions";
import { Dumbbell, MessageSquarePlus, MessagesSquare, Sparkles, Trash2, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// O miolo do chat (ToubeConversation, ~918 linhas + libs do Toube) só monta quando
// o painel abre no clique — que já dispara fetch. Carregar sob demanda tira todo
// esse JS do first-load de TODA página logada (o FloatingToube vive no layout).
const ToubeConversation = dynamic(
  () => import("@/app/(app)/toube/ToubeConversation").then((m) => m.ToubeConversation),
  { ssr: false },
);

type SessionLite = { id: string; title: string | null };

/**
 * O Toube em toda parte: bolha fixa → painel lateral com a MESMA conversa da
 * página /toube. Montado no layout do (app), então sobrevive à navegação — dá
 * pra conversar enquanto usa o app e ver a página atualizar quando ele age.
 * Não aparece em /toube* (lá já é o chat) nem no /diario (o assistente não
 * paira sobre o diário).
 */
export function FloatingToube() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<"chat" | "list">("chat");
  const [sessions, setSessions] = useState<SessionLite[]>([]);

  // Oculta em /toube, /toube/* e /diario (não em rotas futuras tipo /toubeXYZ).
  if (
    pathname === "/toube" ||
    pathname.startsWith("/toube/") ||
    pathname === "/diario" ||
    pathname.startsWith("/diario/")
  ) {
    return null;
  }

  async function openPanel() {
    setOpen(true);
    if (messages !== null) return; // histórico já carregado nesta sessão
    try {
      const res = await fetch("/api/toube");
      const data = await res.json();
      setSessionId(typeof data.sessionId === "string" ? data.sessionId : "");
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setSummary(data.summary ?? null);
    } catch {
      setLoadError(true);
      setMessages([]);
    }
  }

  // Fechar INVALIDA o cache: a conversa do painel é salva em toube_messages, então
  // reabrir refaz o fetch e mostra as mensagens novas (senão o painel remonta stale).
  function closePanel() {
    setOpen(false);
    setMessages(null);
    setSummary(null);
    setLoadError(false);
    setView("chat");
  }

  async function openList() {
    setView("list");
    try {
      const res = await fetch("/api/toube/sessions");
      const data = await res.json();
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch {
      setSessions([]);
    }
  }

  async function loadSession(id?: string) {
    try {
      const res = await fetch(id ? `/api/toube?session=${id}` : "/api/toube");
      const data = await res.json();
      setSessionId(typeof data.sessionId === "string" ? data.sessionId : (id ?? ""));
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setSummary(data.summary ?? null);
    } catch {
      setMessages([]);
    }
    setView("chat");
  }

  async function novaConversa() {
    const { id } = await createSession();
    setSessionId(id);
    setMessages([]);
    setSummary(null);
    setView("chat");
  }

  async function removeSession(id: string) {
    if (!confirm("Apagar essa conversa? Não dá pra desfazer.")) return;
    await deleteSession(id);
    setSessions((s) => s.filter((x) => x.id !== id));
    if (id === sessionId) await loadSession(); // caiu a ativa → recarrega a atual
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={openPanel}
          title="Falar com o Toube"
          className="fixed right-5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex size-13 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 sm:bottom-5"
          style={{ background: "var(--gradient-brand)" }}
        >
          <Sparkles className="size-5" />
        </button>
      ) : null}

      {open ? (
        <aside className="toube-panel fixed right-0 bottom-0 left-0 z-50 flex h-[92dvh] flex-col overflow-hidden rounded-t-2xl md:top-4 md:right-4 md:bottom-4 md:left-auto md:h-auto md:w-[400px] md:rounded-3xl">
          <header
            className="flex items-center gap-2 border-b px-3 py-2.5"
            style={{ borderColor: "color-mix(in srgb, var(--color-border) 40%, transparent)" }}
          >
            <Sparkles className="size-4" style={{ color: "var(--color-accent)" }} />
            <span className="gradient-text text-sm font-semibold">Toube</span>
            <button
              type="button"
              onClick={view === "list" ? () => setView("chat") : openList}
              title="Conversas"
              className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--color-card)]"
              style={{
                borderColor: "color-mix(in srgb, var(--color-border) 55%, transparent)",
                color: "var(--color-fg-muted)",
              }}
            >
              <MessagesSquare className="size-3" />
              Conversas
            </button>
            <Link
              href="/toube/planos"
              onClick={closePanel}
              className="ml-auto flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--color-card)]"
              style={{
                borderColor: "color-mix(in srgb, var(--color-accent) 40%, transparent)",
                color: "var(--color-accent)",
              }}
            >
              <Dumbbell className="size-3" />
              Planos
            </Link>
            <button
              type="button"
              onClick={closePanel}
              title="Fechar"
              className="rounded-lg p-1.5"
              style={{ color: "var(--color-fg-muted)" }}
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 px-2 pb-2">
            {view === "list" ? (
              <div className="flex flex-col gap-1 overflow-y-auto py-2">
                <button
                  type="button"
                  onClick={novaConversa}
                  className="mb-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <MessageSquarePlus className="size-4" />
                  Nova conversa
                </button>
                {sessions.map((s) => (
                  <div key={s.id} className="group flex items-center gap-1 rounded-lg px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => loadSession(s.id)}
                      className="min-w-0 flex-1 truncate text-left text-sm"
                      style={{ color: "var(--color-fg-muted)" }}
                    >
                      {s.title || "Nova conversa"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSession(s.id)}
                      title="Apagar conversa"
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: "var(--color-fg-subtle)" }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
                {sessions.length === 0 ? (
                  <p
                    className="px-2 py-4 text-center text-xs"
                    style={{ color: "var(--color-fg-muted)" }}
                  >
                    Nenhuma conversa ainda.
                  </p>
                ) : null}
              </div>
            ) : messages === null ? (
              <p className="py-10 text-center text-sm" style={{ color: "var(--color-fg-muted)" }}>
                Carregando a conversa…
              </p>
            ) : (
              <>
                {loadError ? (
                  <p className="px-2 pt-2 text-xs" style={{ color: "var(--color-fg-muted)" }}>
                    Não carreguei o histórico, mas pode conversar normal.
                  </p>
                ) : null}
                <ToubeConversation
                  initial={messages}
                  variant="panel"
                  sessionId={sessionId}
                  summary={summary}
                />
              </>
            )}
          </div>
        </aside>
      ) : null}
    </>
  );
}
