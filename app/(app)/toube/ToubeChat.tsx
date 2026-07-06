"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";

export type Message = { id?: string; role: "user" | "assistant"; content: string };

export function ToubeChat({ initial }: { initial: Message[] }) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: messages/sending são gatilhos de rolagem — o efeito só lê endRef, mas queremos rolar até o fim ao chegar mensagem nova ou surgir o "digitando"
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(undefined);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await fetch("/api/toube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao falar com o Toube.");
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const bubbleBase =
    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-3">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm" style={{ color: "var(--color-fg-muted)" }}>
            Manda a primeira mensagem — tô aqui pra ajudar no que precisar.
          </p>
        ) : null}

        {messages.map((m, i) => (
          <div
            key={m.id ?? i}
            className={bubbleBase}
            style={
              m.role === "user"
                ? { alignSelf: "flex-end", background: "var(--gradient-brand)", color: "#fff" }
                : {
                    alignSelf: "flex-start",
                    background: "var(--color-card)",
                    color: "var(--color-fg)",
                    border: "1px solid var(--color-border)",
                  }
            }
          >
            {m.content}
          </div>
        ))}

        {sending ? (
          <div
            className={`${bubbleBase} self-start`}
            style={{
              background: "var(--color-card)",
              color: "var(--color-fg-muted)",
              border: "1px solid var(--color-border)",
            }}
          >
            Toube está digitando…
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      {error ? (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}

      <div
        className="sticky bottom-4 flex items-end gap-2 rounded-2xl p-2"
        style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Escreva pro Toube…"
          className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
          style={{ color: "var(--color-fg)" }}
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !input.trim()}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: "var(--gradient-brand)" }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
