"use client";

import { EMPTY_PLAN, type Plan } from "@/lib/planos-draft";
import { DESTRUCTIVE_ACTIONS, type ToubeAction } from "@/lib/toube";
import { Dumbbell, Mic, Paperclip, Square, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { executeToubeAction } from "./actions";
import { PlanPreview } from "./planos/PlanPreview";
import { criarProgramaCompleto } from "./planos/actions";

type Proposal = {
  action: ToubeAction;
  args: Record<string, unknown>;
  status: "pending" | "running" | "done" | "cancelled" | "error";
  error?: string;
  note?: string;
};

export type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  proposals?: Proposal[];
};

type Attachment = { kind: string; name: string; text: string };

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
    case "lancar_transacao": {
      const tipo = p.args.kind === "income" ? "Receita" : "Gasto";
      const desc = p.args.descricao ? ` · ${p.args.descricao}` : "";
      return `${tipo} de R$ ${String(p.args.valor ?? "")}${desc}`;
    }
    case "adicionar_bloco_rotina":
      return `Rotina: "${String(p.args.titulo ?? "")}" às ${String(p.args.hora ?? "")}`;
    case "criar_lembrete": {
      const msg = String(p.args.mensagem ?? "");
      const hora = String(p.args.hora ?? "");
      return p.args.recorrente
        ? `Lembrete diário · "${msg}" todo dia às ${hora}`
        : p.args.data
          ? `Lembrete · "${msg}" em ${String(p.args.data)} às ${hora}`
          : `Lembrete · "${msg}" na próxima ${hora} (uma vez)`;
    }
    case "criar_nota":
      return `Nota · "${String(p.args.titulo ?? "")}"`;
    case "registrar_medida":
      return `Medida · ${p.args.peso ? `${String(p.args.peso)}kg` : "corpo"}${p.args.cintura_cm ? ` · cintura ${String(p.args.cintura_cm)}cm` : ""}`;
    case "logar_serie":
      return `Série · ${String(p.args.exercicio ?? "exercício")} ${String(p.args.carga ?? "")}kg × ${String(p.args.reps ?? "")}${p.args.rpe ? ` @RPE${String(p.args.rpe)}` : ""}`;
  }
}

// Onde a ação aterrissa — pra confirmação certa depois de executar.
function doneModule(action: ToubeAction): string {
  if (action === "lancar_transacao") return "Finanças";
  if (action === "adicionar_bloco_rotina") return "Rotina";
  if (action === "criar_lembrete") return "Notificações";
  if (action === "criar_nota") return "Notas";
  if (action === "registrar_medida") return "Dieta";
  if (action === "logar_serie") return "Treino";
  return "Metas";
}

/**
 * O miolo do chat do Toube — usado pela página /toube (variant="page") e pelo
 * painel flutuante (variant="panel"). Além do texto: áudio (Whisper → preenche o
 * campo pra revisar) e anexo (imagem "vista" por visão / PDF / txt → entra como
 * bloco [ANEXO] na próxima mensagem). Ação confirmada → router.refresh() pra
 * página ao lado atualizar ao vivo.
 */
export function ToubeConversation({
  initial,
  variant,
}: {
  initial: Message[];
  variant: "page" | "panel";
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initial);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [attachment, setAttachment] = useState<Attachment>();
  const [attaching, setAttaching] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micOk, setMicOk] = useState(true);
  // Modo Plano (toggle ao lado dos anexos): a conversa passa a montar um plano
  // de treino — mesmo cérebro/rascunho da página /toube/planos.
  const [planMode, setPlanMode] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [committing, setCommitting] = useState(false);
  const [planDone, setPlanDone] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const busy = sending || transcribing || attaching || committing;

  async function togglePlanMode() {
    if (busy || recording) return;
    const next = !planMode;
    setPlanMode(next);
    if (next && plan === null) {
      try {
        const res = await fetch("/api/toube/planos");
        const data = await res.json();
        setPlan(res.ok && data.plan ? data.plan : EMPTY_PLAN);
      } catch {
        setPlan(EMPTY_PLAN);
      }
    }
  }

  async function commitPlan() {
    if (busy) return;
    setCommitting(true);
    setError(undefined);
    try {
      const res = await criarProgramaCompleto();
      if (res.error) throw new Error(res.error);
      setPlanDone("✓ Programa criado! Já está no módulo Treino.");
      setPlan(EMPTY_PLAN); // o rascunho fechou; o próximo começa do zero
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar o programa.");
    } finally {
      setCommitting(false);
    }
  }

  useEffect(() => {
    setMicOk(typeof window !== "undefined" && "MediaRecorder" in window);
  }, []);

  // Desmontou gravando (fechou o painel / navegou)? Para o mic NA HORA e libera
  // o stream — senão o navegador segue capturando até o teto de 60s.
  useEffect(() => {
    return () => {
      clearTimeout(stopTimerRef.current);
      const rec = recRef.current;
      if (rec?.state === "recording") {
        rec.onstop = null; // não transcreve órfão em componente morto
        rec.stop();
        for (const t of rec.stream.getTracks()) t.stop();
      }
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: messages/sending são gatilhos de rolagem — o efeito só lê endRef, mas queremos rolar até o fim ao chegar mensagem nova ou surgir o "digitando"
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const typed = input.trim();
    if ((!typed && !attachment) || busy) return;
    // O anexo vira um bloco junto da mensagem — o Toube "vê" o conteúdo extraído.
    const text = attachment
      ? `${typed || "Dá uma olhada nesse anexo."}\n\n[ANEXO ${attachment.kind} — ${attachment.name}]:\n${attachment.text}`
      : typed;
    setError(undefined);
    setInput("");
    setAttachment(undefined);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      if (planMode) {
        // URL sozinha vira FONTE (YouTube/link → transcript/texto); o resto vai
        // pro chat do plano. O anexo já chega como texto dentro da mensagem.
        const isUrl = /^https?:\/\/\S+$/.test(typed) && !attachment;
        const res = await fetch(isUrl ? "/api/toube/planos/fonte" : "/api/toube/planos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isUrl ? { url: typed } : { message: text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro no modo Plano.");
        setPlan(data.plan);
        setPlanDone(undefined);
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
        return;
      }
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
      patchProposal(
        mi,
        pi,
        res.error ? { status: "error", error: res.error } : { status: "done", note: res.note },
      );
      // Mudança ao vivo: a página atual re-renderiza com o dado novo.
      if (!res.error) router.refresh();
    } catch {
      patchProposal(mi, pi, { status: "error", error: "Falha ao executar." });
    }
  }

  // ─── Áudio: grava → Whisper → preenche o campo (a pessoa revisa e envia) ───
  async function startRecording() {
    if (busy || recording) return;
    setError(undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        for (const t of stream.getTracks()) t.stop();
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (!blob.size) return;
        setTranscribing(true);
        try {
          const fd = new FormData();
          const ext = (rec.mimeType || "").includes("mp4") ? "mp4" : "webm";
          fd.set("audio", blob, `fala.${ext}`);
          const res = await fetch("/api/toube/transcribe", { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Não consegui ouvir.");
          setInput((cur) => (cur ? `${cur} ${data.text}` : data.text));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Não consegui ouvir o áudio.");
        } finally {
          setTranscribing(false);
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      // Teto de ~60s: corta sozinho.
      stopTimerRef.current = setTimeout(() => stopRecording(), 60_000);
    } catch {
      setMicOk(false);
      setError("Não consegui acessar o microfone (permissão?).");
    }
  }

  function stopRecording() {
    clearTimeout(stopTimerRef.current);
    if (recRef.current?.state === "recording") recRef.current.stop();
  }

  // ─── Anexo: imagem/PDF/txt → texto que o Toube consegue ver ───
  async function attachFile(file: File) {
    if (busy) return;
    setError(undefined);
    if (file.size > 8 * 1024 * 1024) {
      setError("Arquivo grande demais (máx 8MB).");
      return;
    }
    setAttaching(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/toube/anexo", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não consegui ler o anexo.");
      setAttachment({ kind: data.kind, name: file.name, text: data.text });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não consegui ler o anexo.");
    } finally {
      setAttaching(false);
      if (fileRef.current) fileRef.current.value = "";
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
  const isPanel = variant === "panel";

  const inputBar = (
    <div
      className={`flex items-end gap-1.5 rounded-2xl p-2 ${isPanel ? "" : "sticky bottom-4"}`}
      style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}
    >
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy || recording}
        title="Anexar imagem, PDF ou texto"
        className="rounded-lg p-2 disabled:opacity-40"
        style={{ color: "var(--color-fg-muted)" }}
      >
        <Paperclip className="size-4" />
      </button>
      <button
        type="button"
        onClick={togglePlanMode}
        disabled={busy || recording}
        title={planMode ? "Sair do modo Plano" : "Modo Plano de treino"}
        className="rounded-lg p-2 disabled:opacity-40"
        style={
          planMode
            ? { color: "#fff", background: "var(--gradient-brand)" }
            : { color: "var(--color-fg-muted)" }
        }
      >
        <Dumbbell className="size-4" />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,text/plain,text/markdown,.md,.txt"
        hidden
        onChange={(e) => e.target.files?.[0] && attachFile(e.target.files[0])}
      />
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder={
          recording
            ? "Gravando… toca no quadrado pra parar"
            : transcribing
              ? "Transcrevendo…"
              : attaching
                ? "Lendo o anexo…"
                : planMode
                  ? "Modo Plano — descreve teu treino ou cola um link do YouTube…"
                  : "Escreva ou fale com o Toube…"
        }
        className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
        style={{ color: "var(--color-fg)" }}
      />
      {micOk ? (
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={busy}
          title={recording ? "Parar gravação" : "Falar com o Toube"}
          className="rounded-lg p-2 disabled:opacity-40"
          style={{ color: recording ? "var(--color-danger)" : "var(--color-fg-muted)" }}
        >
          {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
        </button>
      ) : null}
      <button
        type="button"
        onClick={send}
        disabled={busy || recording || (!input.trim() && !attachment)}
        className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        style={{ background: "var(--gradient-brand)" }}
      >
        Enviar
      </button>
    </div>
  );

  return (
    <div
      className={
        isPanel
          ? "flex h-full min-h-0 flex-col gap-2"
          : "mx-auto flex w-full max-w-2xl flex-col gap-4"
      }
    >
      <div
        className={
          isPanel
            ? "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-2"
            : "flex flex-col gap-3"
        }
      >
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
                        ? `✓ Feito! Já está no módulo ${doneModule(p.action)}.${p.note ? ` ${p.note}` : ""}`
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

      {planMode ? (
        <div
          className="rounded-2xl border p-2"
          style={{ borderColor: "var(--color-accent)", background: "var(--color-bg-elevated)" }}
        >
          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <span
              className="flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: "var(--color-accent)" }}
            >
              <Dumbbell className="size-3.5" />
              Modo Plano de treino
            </span>
            {plan?.days.length ? (
              <button
                type="button"
                onClick={commitPlan}
                disabled={busy}
                className="rounded-lg px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--gradient-brand)" }}
              >
                {committing ? "Criando…" : "Criar programa completo"}
              </button>
            ) : null}
          </div>
          <div className="max-h-56 overflow-y-auto">
            {plan === null ? (
              <p className="p-3 text-xs" style={{ color: "var(--color-fg-muted)" }}>
                Carregando o rascunho…
              </p>
            ) : (
              <PlanPreview plan={plan} />
            )}
          </div>
          {planDone ? (
            <p className="px-1 pt-1 text-xs" style={{ color: "var(--color-fg-muted)" }}>
              {planDone}
            </p>
          ) : null}
        </div>
      ) : null}

      {attachment ? (
        <div
          className="flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs"
          style={{ borderColor: "var(--color-accent)", color: "var(--color-fg)" }}
        >
          <Paperclip className="size-3" />
          <span className="max-w-48 truncate">
            {attachment.name} ({attachment.kind})
          </span>
          <button
            type="button"
            onClick={() => setAttachment(undefined)}
            title="Remover anexo"
            style={{ color: "var(--color-fg-muted)" }}
          >
            <X className="size-3" />
          </button>
        </div>
      ) : null}

      {inputBar}
    </div>
  );
}
