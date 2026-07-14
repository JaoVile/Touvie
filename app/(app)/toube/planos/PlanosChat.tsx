"use client";
import { EMPTY_PLAN, type Plan } from "@/lib/planos-draft";
import { type KeyboardEvent, useState } from "react";
import { PlanPreview } from "./PlanPreview";
import { SourceInput } from "./SourceInput";
import { criarProgramaCompleto, novoRascunho } from "./actions";

type Msg = { role: "user" | "assistant"; content: string };

export function PlanosChat({ initialPlan }: { initialPlan: Plan }) {
  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [done, setDone] = useState<string>();
  const [error, setError] = useState<string>();

  const anyBusy = sending || committing || sourceBusy;

  async function send() {
    const text = input.trim();
    if (!text || anyBusy) return;
    setError(undefined);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await fetch("/api/toube/planos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages.slice(-24) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro.");
      setPlan(data.plan);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro.");
    } finally {
      setSending(false);
    }
  }

  function onSource(reply: string, p: Plan) {
    setPlan(p);
    setMessages((m) => [...m, { role: "assistant", content: reply }]);
  }

  async function commit() {
    if (anyBusy) return;
    setCommitting(true);
    setError(undefined);
    try {
      const res = await criarProgramaCompleto();
      if (res.error) throw new Error(res.error);
      setDone("✓ Programa criado! Já está no módulo Treino.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar.");
    } finally {
      setCommitting(false);
    }
  }

  async function montarOutro() {
    if (anyBusy) return;
    setCommitting(true);
    try {
      await novoRascunho();
      setPlan(EMPTY_PLAN);
      setMessages([]);
      setDone(undefined);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao reiniciar.");
    } finally {
      setCommitting(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const bubble = "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed";

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-2">
      {/* Painel do plano vivo */}
      <div className="order-1 md:order-2">
        <div
          className="rounded-2xl border p-2"
          style={{ borderColor: "var(--color-border)", background: "var(--color-bg-elevated)" }}
        >
          <PlanPreview plan={plan} />
        </div>
        {plan.days.length && !done ? (
          <button
            type="button"
            onClick={commit}
            disabled={anyBusy}
            className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            {committing ? "Criando…" : "Criar programa completo"}
          </button>
        ) : null}
        {done ? (
          <>
            <p className="mt-2 text-sm" style={{ color: "var(--color-fg-muted)" }}>
              {done}
            </p>
            <button
              type="button"
              onClick={montarOutro}
              disabled={anyBusy}
              className="mt-2 w-full rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: "var(--color-border)", color: "var(--color-fg)" }}
            >
              Montar outro plano
            </button>
          </>
        ) : null}
      </div>

      {/* Chat */}
      <div className="order-2 flex flex-col gap-3 md:order-1">
        <SourceInput
          onResult={onSource}
          onBusyChange={setSourceBusy}
          disabled={sending || committing}
        />
        <div className="flex flex-col gap-2">
          {messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={bubble}
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
              className={`${bubble} self-start`}
              style={{
                background: "var(--color-card)",
                color: "var(--color-fg-muted)",
                border: "1px solid var(--color-border)",
              }}
            >
              Montando…
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="text-xs" style={{ color: "var(--color-danger)" }}>
            {error}
          </p>
        ) : null}
        <div
          className="sticky bottom-4 flex items-end gap-2 rounded-2xl p-2"
          style={{
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            disabled={anyBusy}
            placeholder="Fala como quer o treino…"
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none disabled:opacity-50"
            style={{ color: "var(--color-fg)" }}
          />
          <button
            type="button"
            onClick={send}
            disabled={anyBusy || !input.trim()}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--gradient-brand)" }}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
