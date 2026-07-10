"use client";

import { DESTRUCTIVE_ACTIONS, type ToubeAction } from "@/lib/toube";
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
  proposals?: Proposal[];
};

function proposalLabel(p: Proposal): string {
  const t = String(p.args.title ?? p.args.titulo ?? "");
  const alvo = t ? ` "${t}"` : "";
  switch (p.action) {
    case "criar_meta":
      return `Criar meta${alvo}${p.args.target_date ? ` · prazo ${p.args.target_date}` : ""}`;
    case "editar_meta":
      return `Editar meta${alvo}`;
    case "concluir_meta":
      return `Concluir meta${alvo}`;
    case "deletar_meta":
      return `Apagar meta${alvo}`;
    case "criar_tarefa":
      return `Criar tarefa${alvo}${p.args.due_date ? ` · até ${p.args.due_date}` : ""}`;
    case "concluir_tarefa":
      return `Concluir tarefa${alvo}`;
    case "deletar_tarefa":
      return `Apagar tarefa${alvo}`;
  }
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
      const proposals: Proposal[] | undefined = Array.isArray(data.proposals)
        ? data.proposals.map((p: { action: ToubeAction; args: Record<string, unknown> }) => ({
            action: p.action,
            args: p.args,
            status: "pending" as const,
          }))
        : undefined;
      setMessages((m) => [...m, { role: "assistant", content: data.reply, proposals }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSending(false);
    }
  }

  function patchProposal(mi: number, pi: number, patch: Partial<Proposal>) {
    setMessages((m) =>
      m.map((mm, i) =>
        i === mi && mm.proposals
          ? { ...mm, proposals: mm.proposals.map((pp, j) => (j === pi ? { ...pp, ...patch } : pp)) }
          : mm,
      ),
    );
  }

  async function confirmProposal(mi: number, pi: number) {
    const p = messages[mi]?.proposals?.[pi];
    if (!p || p.status !== "pending") return;
    patchProposal(mi, pi, { status: "running" });
    try {
      const res = await executeToubeAction(p.action, p.args);
      patchProposal(mi, pi, res.error ? { status: "error", error: res.error } : { status: "done" });
    } catch {
      patchProposal(mi, pi, { status: "error", error: "Falha ao executar." });
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

            {m.proposals?.map((p, j) => {
              const danger = DESTRUCTIVE_ACTIONS.includes(p.action);
              return (
                <div
                  key={`${p.action}-${j}`}
                  className="w-full max-w-[85%] self-start rounded-xl border p-3 text-sm"
                  style={{
                    borderColor: danger ? "var(--color-danger)" : "var(--color-accent)",
                    background: "var(--color-card)",
                  }}
                >
                  <p
                    className="font-medium"
                    style={danger ? { color: "var(--color-danger)" } : undefined}
                  >
                    {danger ? "⚠️ " : ""}
                    {proposalLabel(p)}
                  </p>
                  {p.status === "pending" || p.status === "running" ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => confirmProposal(i, j)}
                        disabled={p.status === "running"}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        style={{
                          background: danger ? "var(--color-danger)" : "var(--gradient-brand)",
                        }}
                      >
                        {p.status === "running"
                          ? "Fazendo…"
                          : danger
                            ? "Apagar mesmo assim"
                            : "Confirmar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => patchProposal(i, j, { status: "cancelled" })}
                        disabled={p.status === "running"}
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                        style={{
                          borderColor: "var(--color-border)",
                          color: "var(--color-fg-muted)",
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <p
                      className="mt-1 text-xs"
                      style={{
                        color:
                          p.status === "error" ? "var(--color-danger)" : "var(--color-fg-muted)",
                      }}
                    >
                      {p.status === "done"
                        ? "✓ Feito! Já está no módulo Metas."
                        : p.status === "cancelled"
                          ? "Cancelado."
                          : `Erro: ${p.error ?? "não deu"}`}
                    </p>
                  )}
                </div>
              );
            })}
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
