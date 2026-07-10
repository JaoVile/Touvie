"use client";

import type { ToubeAction } from "@/lib/toube";
import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { executeToubeAction } from "./actions";

type Proposal = {
  action: ToubeAction;
  args: Record<string, unknown>;
  status: "pending" | "running" | "done" | "cancelled" | "error";
  error?: string;
};

export type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  proposal?: Proposal;
};

function proposalLabel(p: Proposal): string {
  const t = String(p.args.title ?? "");
  if (p.action === "criar_meta") {
    return `Meta: "${t}"${p.args.target_date ? ` · prazo ${p.args.target_date}` : ""}`;
  }
  return `Tarefa: "${t}"${p.args.due_date ? ` · até ${p.args.due_date}` : ""}`;
}

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
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.reply,
          proposal: data.proposal
            ? { action: data.proposal.action, args: data.proposal.args, status: "pending" }
            : undefined,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSending(false);
    }
  }

  function setProposalStatus(index: number, patch: Partial<Proposal>) {
    setMessages((m) =>
      m.map((mm, i) =>
        i === index && mm.proposal ? { ...mm, proposal: { ...mm.proposal, ...patch } } : mm,
      ),
    );
  }

  async function confirmProposal(index: number) {
    const p = messages[index]?.proposal;
    if (!p || p.status !== "pending") return;
    setProposalStatus(index, { status: "running" });
    try {
      const res = await executeToubeAction(p.action, p.args);
      setProposalStatus(
        index,
        res.error ? { status: "error", error: res.error } : { status: "done" },
      );
    } catch {
      setProposalStatus(index, { status: "error", error: "Falha ao executar." });
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
          <div key={m.id ?? i} className="flex flex-col gap-2" style={{ alignItems: "stretch" }}>
            <div
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

            {m.proposal ? (
              <div
                className="self-start w-full max-w-[85%] rounded-xl border p-3 text-sm"
                style={{ borderColor: "var(--color-accent)", background: "var(--color-card)" }}
              >
                <p className="font-medium">{proposalLabel(m.proposal)}</p>
                {m.proposal.status === "pending" || m.proposal.status === "running" ? (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => confirmProposal(i)}
                      disabled={m.proposal.status === "running"}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: "var(--gradient-brand)" }}
                    >
                      {m.proposal.status === "running" ? "Criando…" : "Confirmar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setProposalStatus(i, { status: "cancelled" })}
                      disabled={m.proposal.status === "running"}
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                      style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <p
                    className="mt-1 text-xs"
                    style={{
                      color:
                        m.proposal.status === "error"
                          ? "var(--color-danger)"
                          : "var(--color-fg-muted)",
                    }}
                  >
                    {m.proposal.status === "done"
                      ? "✓ Criado! Já está no módulo Metas."
                      : m.proposal.status === "cancelled"
                        ? "Cancelado."
                        : `Erro: ${m.proposal.error ?? "não deu"}`}
                  </p>
                )}
              </div>
            ) : null}
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
