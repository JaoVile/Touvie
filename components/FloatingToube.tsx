"use client";

import { type Message, ToubeConversation } from "@/app/(app)/toube/ToubeConversation";
import { Dumbbell, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
  const [loadError, setLoadError] = useState(false);

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
      setMessages(Array.isArray(data.messages) ? data.messages : []);
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
    setLoadError(false);
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
        <aside
          className="fixed inset-x-0 bottom-0 z-50 flex h-[92dvh] flex-col rounded-t-2xl border shadow-2xl md:inset-x-auto md:top-0 md:right-0 md:h-dvh md:w-[400px] md:rounded-none md:border-y-0 md:border-r-0"
          style={{ background: "var(--color-bg-elevated)", borderColor: "var(--color-border)" }}
        >
          <header
            className="flex items-center gap-2 border-b px-3 py-2.5"
            style={{ borderColor: "var(--color-border)" }}
          >
            <Sparkles className="size-4" style={{ color: "var(--color-accent)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--color-fg)" }}>
              Toube
            </span>
            <Link
              href="/toube/planos"
              onClick={closePanel}
              className="ml-auto flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
              style={{ borderColor: "var(--color-border)", color: "var(--color-accent)" }}
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
            {messages === null ? (
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
                <ToubeConversation initial={messages} variant="panel" />
              </>
            )}
          </div>
        </aside>
      ) : null}
    </>
  );
}
