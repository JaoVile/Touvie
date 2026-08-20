"use client";

import { EMPTY_PLAN, type Plan } from "@/lib/planos-draft";
import { DESTRUCTIVE_ACTIONS, type ToubeAction } from "@/lib/toube";
import { toubeVoice } from "@/lib/toube-voice";
import {
  Check,
  Dumbbell,
  Mic,
  Paperclip,
  Pencil,
  RefreshCw,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { ClipboardEvent, KeyboardEvent } from "react";
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

/** Converte as propostas cruas do POST /api/toube pro shape da UI. */
function parseProposals(data: { proposals?: unknown }): Proposal[] | undefined {
  return Array.isArray(data.proposals)
    ? (data.proposals as { action: ToubeAction; args: Record<string, unknown> }[]).map((p) => ({
        action: p.action,
        args: p.args,
        status: "pending" as const,
      }))
    : undefined;
}

type T = ReturnType<typeof useTranslations>;

function proposalLabel(p: Proposal, t: T): string {
  const title = String(p.args.title ?? p.args.titulo ?? "");
  const alvo = title ? ` "${title}"` : "";
  switch (p.action) {
    case "criar_meta":
      return `${t("prop.createGoal")}${alvo}${p.args.target_date ? t("prop.due", { d: String(p.args.target_date) }) : ""}`;
    case "editar_meta":
      return `${t("prop.editGoal")}${alvo}`;
    case "concluir_meta":
      return `${t("prop.completeGoal")}${alvo}`;
    case "deletar_meta":
      return `${t("prop.deleteGoal")}${alvo}`;
    case "criar_tarefa":
      return `${t("prop.createTask")}${alvo}${p.args.due_date ? t("prop.by", { d: String(p.args.due_date) }) : ""}`;
    case "concluir_tarefa":
      return `${t("prop.completeTask")}${alvo}`;
    case "deletar_tarefa":
      return `${t("prop.deleteTask")}${alvo}`;
    case "lancar_transacao": {
      const tipo = t(p.args.kind === "income" ? "prop.income" : "prop.expense");
      const desc = p.args.descricao ? ` · ${String(p.args.descricao)}` : "";
      return `${t("prop.amount", { tipo, valor: String(p.args.valor ?? "") })}${desc}`;
    }
    case "adicionar_bloco_rotina":
      return t("prop.routine", {
        titulo: String(p.args.titulo ?? ""),
        hora: String(p.args.hora ?? ""),
      });
    case "criar_lembrete": {
      const msg = String(p.args.mensagem ?? "");
      const hora = String(p.args.hora ?? "");
      return p.args.recorrente
        ? t("prop.reminderDaily", { msg, hora })
        : p.args.data
          ? t("prop.reminderOn", { msg, hora, data: String(p.args.data) })
          : t("prop.reminderNext", { msg, hora });
    }
    case "criar_nota":
      return t("prop.note", { titulo: String(p.args.titulo ?? "") });
    case "registrar_medida": {
      const corpo = p.args.peso ? `${String(p.args.peso)}kg` : t("prop.body");
      const cintura = p.args.cintura_cm ? t("prop.waist", { v: String(p.args.cintura_cm) }) : "";
      return `${t("prop.measure", { corpo })}${cintura}`;
    }
    case "logar_serie":
      return `${t("prop.series", {
        ex: String(p.args.exercicio ?? t("prop.exercise")),
        carga: String(p.args.carga ?? ""),
        reps: String(p.args.reps ?? ""),
      })}${p.args.rpe ? ` @RPE${String(p.args.rpe)}` : ""}`;
  }
}

// Onde a ação aterrissa — pra confirmação certa depois de executar.
function doneModule(action: ToubeAction, t: T): string {
  if (action === "lancar_transacao") return t("modules.finances");
  if (action === "adicionar_bloco_rotina") return t("modules.routine");
  if (action === "criar_lembrete") return t("modules.notifications");
  if (action === "criar_nota") return t("modules.notes");
  if (action === "registrar_medida") return t("modules.diet");
  if (action === "logar_serie") return t("modules.workout");
  return t("modules.goals");
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
  sessionId,
  summary,
}: {
  initial: Message[];
  variant: "page" | "panel";
  sessionId: string;
  // Resumo rolante da sessão (Task 1/3) — quando presente, vira uma bolha fixa
  // no topo da lista pra dar contexto do que já rolou antes da poda.
  summary?: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("toube");
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
  // Histórico SÓ do diálogo do modo Plano (separado da conversa normal do Toube),
  // pra o construtor lembrar as perguntas/respostas — "quantos dias?" → "4".
  const [planHistory, setPlanHistory] = useState<{ role: "user" | "assistant"; content: string }[]>(
    [],
  );
  const [loadingPlan, setLoadingPlan] = useState(false); // trava síncrona do toggle
  const [startingRec, setStartingRec] = useState(false); // trava síncrona do mic
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const busy = sending || transcribing || attaching || committing || loadingPlan;

  // Auto-grow do textarea do composer: 1 linha em repouso, cresce com o texto
  // até o teto de 160px (= max-h-40). Overflow fica escondido abaixo do teto —
  // com rows fixo o browser renderiza scrollbar interna (setinhas) e corta o texto.
  // biome-ignore lint/correctness/useExhaustiveDependencies: input é o gatilho — o efeito só lê o DOM, mas precisa rodar a cada mudança de texto (inclusive setInput programático da transcrição)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    el.style.overflowY = el.scrollHeight > 160 ? "auto" : "hidden";
  }, [input]);

  // Voz do Toube (TTS do navegador). Sincroniza suporte/estado só no cliente
  // (evita mismatch de hydration) e corta a fala ao desmontar (fechar painel /
  // trocar de rota) — senão ele continua falando sozinho.
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  // Edição de mensagem enviada (estilo Gemini): índice da msg em edição + rascunho.
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  useEffect(() => {
    setVoiceSupported(toubeVoice.supported);
    setVoiceOn(toubeVoice.enabled);
    return () => toubeVoice.stop();
  }, []);

  function toggleVoice() {
    const next = !voiceOn;
    toubeVoice.setEnabled(next);
    setVoiceOn(next);
    // Feedback imediato ao ligar (e destrava o autoplay dentro do gesto do clique).
    if (next) void toubeVoice.speak(t("voiceOnSpoken"));
  }

  async function togglePlanMode() {
    if (busy || recording) return;
    const next = !planMode;
    setPlanMode(next);
    if (next) {
      setPlanHistory([]); // sessão de plano nova começa sem histórico
      setPlanDone(undefined); // não deixa banner "✓ criado" grudado no plano novo
    }
    if (next && plan === null) {
      setLoadingPlan(true);
      try {
        const res = await fetch("/api/toube/planos");
        const data = await res.json();
        setPlan(res.ok && data.plan ? data.plan : EMPTY_PLAN);
      } catch {
        setPlan(EMPTY_PLAN);
      } finally {
        setLoadingPlan(false);
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
      setPlanDone(t("planCreated"));
      setPlan(EMPTY_PLAN); // o rascunho fechou; o próximo começa do zero
      setPlanHistory([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errProgram"));
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
      ? `${typed || t("attachDefaultMsg")}\n\n[ANEXO ${attachment.kind} — ${attachment.name}]:\n${attachment.text}`
      : typed;
    setError(undefined);
    setInput("");
    setAttachment(undefined);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    toubeVoice.prime(); // acorda o áudio já no envio — a fala entra sem engasgo
    try {
      if (planMode) {
        // URL sozinha vira FONTE (YouTube/link → transcript/texto); o resto vai
        // pro chat do plano. O anexo já chega como texto dentro da mensagem.
        const isUrl = /^https?:\/\/\S+$/.test(typed) && !attachment;
        const res = await fetch(isUrl ? "/api/toube/planos/fonte" : "/api/toube/planos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isUrl ? { url: typed } : { message: text, history: planHistory.slice(-24) },
          ),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? t("errPlan"));
        setPlan(data.plan);
        setPlanDone(undefined);
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
        toubeVoice.speak(data.reply);
        setPlanHistory((h) => [
          ...h,
          { role: "user", content: text },
          { role: "assistant", content: data.reply },
        ]);
        return;
      }
      const res = await fetch("/api/toube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("errTalk"));
      const proposals = parseProposals(data);
      setMessages((m) => {
        const copy = [...m];
        // Atribui o id que o servidor devolveu à msg do usuário recém-enviada —
        // sem id não dá pra editá-la depois.
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === "user" && !copy[i].id) {
            copy[i] = { ...copy[i], id: data.user_message_id ?? undefined };
            break;
          }
        }
        copy.push({
          id: data.assistant_message_id ?? undefined,
          role: "assistant",
          content: data.reply,
          proposals,
        });
        return copy;
      });
      toubeVoice.speak(data.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errUnexpected"));
    } finally {
      setSending(false);
    }
  }

  function startEdit(i: number) {
    if (busy || recording || planMode) return;
    setEditingIdx(i);
    setEditText(messages[i]?.content ?? "");
  }

  /** Salva a edição: o servidor troca o texto, poda o que veio depois e responde de novo. */
  async function confirmEdit() {
    if (editingIdx === null) return;
    const kept = editingIdx;
    const target = messages[kept];
    const text = editText.trim();
    if (!target?.id || !text || busy) return;
    setError(undefined);
    setEditingIdx(null);
    setSending(true);
    toubeVoice.prime();
    // Poda otimista: a conversa recomeça na mensagem editada (igual ao servidor).
    setMessages((m) => [...m.slice(0, kept), { ...target, content: text }]);
    try {
      const res = await fetch("/api/toube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId, edit_message_id: target.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("errEdit"));
      setMessages((m) => [
        ...m,
        {
          id: data.assistant_message_id ?? undefined,
          role: "assistant",
          content: data.reply,
          proposals: parseProposals(data),
        },
      ]);
      toubeVoice.speak(data.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errUnexpected"));
    } finally {
      setSending(false);
    }
  }

  /** Regenera a última resposta: o servidor apaga a dele e gera outra no lugar. */
  async function regenerate() {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || busy || recording || planMode) return;
    setError(undefined);
    setSending(true);
    toubeVoice.prime();
    setMessages((m) => m.slice(0, -1)); // remove otimista; o servidor apaga a dele
    try {
      const res = await fetch("/api/toube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, regenerate: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("errRegen"));
      setMessages((m) => [
        ...m,
        {
          id: data.assistant_message_id ?? undefined,
          role: "assistant",
          content: data.reply,
          proposals: parseProposals(data),
        },
      ]);
      toubeVoice.speak(data.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errUnexpected"));
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
      patchProposal(mi, pi, { status: "error", error: t("errExec") });
    }
  }

  // ─── Áudio: grava → Whisper → preenche o campo (a pessoa revisa e envia) ───
  async function startRecording() {
    if (busy || recording || startingRec) return;
    setStartingRec(true); // trava síncrona: 2 cliques rápidos não abrem 2 streams
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
          if (!res.ok) throw new Error(data.error ?? t("errHear"));
          setInput((cur) => (cur ? `${cur} ${data.text}` : data.text));
        } catch (e) {
          setError(e instanceof Error ? e.message : t("errHearAudio"));
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
      setError(t("errMic"));
    } finally {
      setStartingRec(false);
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
      setError(t("errTooBig"));
      return;
    }
    setAttaching(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/toube/anexo", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("errAttach"));
      setAttachment({ kind: data.kind, name: file.name, text: data.text });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errAttach"));
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

  // Colar imagem (Ctrl+V depois de um print) → vai pelo mesmo fluxo de anexo
  // (Scout descreve). Sem imagem no clipboard, deixa colar texto normal.
  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const img = Array.from(e.clipboardData.items).find((it) => it.type.startsWith("image/"));
    if (!img) return;
    const file = img.getAsFile();
    if (!file) return;
    e.preventDefault();
    attachFile(file);
  }

  // Balões estilo mensageiro: bem arredondados, com UM canto fechado (o de baixo,
  // do lado de quem falou) fazendo o "rabinho". Sombra sutil pra chique. A largura
  // máxima fica no wrapper da LINHA (que também carrega o lápis de editar).
  const bubbleBase =
    "whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-sm leading-relaxed shadow-sm";
  const isPanel = variant === "panel";

  const inputBar = (
    <div
      className={`toube-composer flex items-end gap-1 rounded-3xl border p-2 transition-colors ${
        isPanel ? "" : "sticky bottom-4"
      }`}
      style={{ background: "var(--color-bg-elevated)" }}
    >
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy || recording}
        title={t("tAttach")}
        className="rounded-full p-2 transition-colors hover:bg-[var(--color-card)] disabled:opacity-40"
        style={{ color: "var(--color-fg-muted)" }}
      >
        <Paperclip className="size-4" />
      </button>
      <button
        type="button"
        onClick={togglePlanMode}
        disabled={busy || recording}
        title={planMode ? t("tPlanOn") : t("tPlanOff")}
        className="rounded-full p-2 transition-colors hover:bg-[var(--color-card)] disabled:opacity-40"
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
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        rows={1}
        placeholder={
          recording
            ? t("phRecording")
            : transcribing
              ? t("phTranscribing")
              : attaching
                ? t("phAttaching")
                : planMode
                  ? t("phPlan")
                  : isPanel
                    ? t("phPanel")
                    : t("phPage")
        }
        className="max-h-40 flex-1 resize-none overflow-y-hidden bg-transparent px-2 py-1.5 text-sm outline-none"
        style={{ color: "var(--color-fg)" }}
      />
      {micOk ? (
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={busy || startingRec}
          title={recording ? t("tStopRec") : t("tRec")}
          className="rounded-full p-2 transition-colors hover:bg-[var(--color-card)] disabled:opacity-40"
          style={{ color: recording ? "var(--color-danger)" : "var(--color-fg-muted)" }}
        >
          {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
        </button>
      ) : null}
      {voiceSupported ? (
        <button
          type="button"
          onClick={toggleVoice}
          title={voiceOn ? t("tVoiceOff") : t("tVoiceOn")}
          aria-pressed={voiceOn}
          className="rounded-full p-2 transition-colors hover:bg-[var(--color-card)]"
          style={{ color: voiceOn ? "var(--color-accent)" : "var(--color-fg-muted)" }}
        >
          {voiceOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
      ) : null}
      <button
        type="button"
        onClick={send}
        disabled={busy || recording || (!input.trim() && !attachment)}
        className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:enabled:scale-[1.03] active:enabled:scale-95 disabled:opacity-40"
        style={{ background: "var(--gradient-brand)" }}
      >
        {t("send")}
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
        {summary && (
          <div
            className="rounded-lg border px-3 py-2 text-sm opacity-80"
            style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
          >
            <div className="mb-1 font-semibold">{t("resumoTitulo")}</div>
            <p className="whitespace-pre-wrap">{summary}</p>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span
              className="flex size-12 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Sparkles className="size-5" />
            </span>
            <p className="gradient-text text-base font-semibold">{t("emptyTitle")}</p>
            <p className="max-w-xs text-sm" style={{ color: "var(--color-fg-muted)" }}>
              {t("emptyBody")}
            </p>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div key={m.id ?? i} className="flex flex-col gap-2" style={{ alignItems: "stretch" }}>
            {m.role === "user" && editingIdx === i ? (
              <div
                className={`${bubbleBase} w-full max-w-[85%] self-end rounded-br-md`}
                style={{ background: "var(--gradient-brand)", color: "#fff" }}
              >
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  // biome-ignore lint/a11y/noAutofocus: a pessoa acabou de clicar em "editar" — o foco imediato no texto é o esperado
                  autoFocus
                  className="w-full resize-none bg-transparent text-sm leading-relaxed text-white outline-none"
                />
                <div className="mt-1 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingIdx(null)}
                    title={t("tCancelEdit")}
                    className="rounded-full p-1.5 transition-colors hover:bg-white/15"
                  >
                    <X className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={confirmEdit}
                    disabled={!editText.trim() || busy}
                    title={t("tSaveResend")}
                    className="rounded-full p-1.5 transition-colors hover:bg-white/15 disabled:opacity-40"
                  >
                    <Check className="size-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`group flex max-w-[78%] items-end gap-1.5 ${
                  m.role === "user" ? "self-end" : "self-start"
                }`}
              >
                {m.role === "user" && m.id && !planMode ? (
                  <button
                    type="button"
                    onClick={() => startEdit(i)}
                    disabled={busy || recording}
                    title={t("tEditResend")}
                    className="shrink-0 rounded-full p-1.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-0"
                    style={{ color: "var(--color-fg-subtle)" }}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                ) : null}
                <div
                  className={`${bubbleBase} min-w-0 ${
                    m.role === "user" ? "rounded-br-md" : "rounded-bl-md"
                  }`}
                  style={
                    m.role === "user"
                      ? { background: "var(--gradient-brand)", color: "#fff" }
                      : {
                          background: "var(--color-card)",
                          color: "var(--color-fg)",
                          border:
                            "1px solid color-mix(in srgb, var(--color-border) 55%, transparent)",
                        }
                  }
                >
                  {m.content}
                </div>
                {m.role === "assistant" ? (
                  <button
                    type="button"
                    onClick={() => void toubeVoice.speak(m.content, { force: true })}
                    title={t("tListen")}
                    className="shrink-0 rounded-full p-1.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    style={{ color: "var(--color-fg-subtle)" }}
                  >
                    <Volume2 className="size-3.5" />
                  </button>
                ) : null}
              </div>
            )}

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
                    {proposalLabel(p, t)}
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
                          ? t("doing")
                          : danger
                            ? t("deleteAnyway")
                            : t("confirm")}
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
                        {t("cancel")}
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
                        ? `${t("doneNote", { module: doneModule(p.action, t) })}${p.note ? ` ${p.note}` : ""}`
                        : p.status === "cancelled"
                          ? t("cancelled")
                          : t("errorLine", { msg: p.error ?? t("errorFallback") })}
                    </p>
                  )}
                </div>
              );
            })}

            {i === messages.length - 1 && m.role === "assistant" && !sending && !planMode ? (
              <button
                type="button"
                onClick={regenerate}
                disabled={busy || recording}
                title={t("regenerateTitle")}
                className="flex items-center gap-1 self-start rounded-full px-2 py-1 text-xs transition-colors hover:bg-[var(--color-card)] disabled:opacity-40"
                style={{ color: "var(--color-fg-subtle)" }}
              >
                <RefreshCw className="size-3" />
                {t("regenerate")}
              </button>
            ) : null}
          </div>
        ))}

        {sending ? (
          <div
            className={`${bubbleBase} self-start rounded-bl-md`}
            style={{
              background: "var(--color-card)",
              color: "var(--color-fg-muted)",
              border: "1px solid color-mix(in srgb, var(--color-border) 55%, transparent)",
            }}
          >
            <span className="toube-typing" aria-label={t("typing")}>
              <span />
              <span />
              <span />
            </span>
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
              {t("planTitle")}
            </span>
            {plan?.days.length ? (
              <button
                type="button"
                onClick={commitPlan}
                disabled={busy}
                className="rounded-lg px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--gradient-brand)" }}
              >
                {committing ? t("planCreating") : t("planCreate")}
              </button>
            ) : null}
          </div>
          <div className="max-h-56 overflow-y-auto">
            {plan === null ? (
              <p className="p-3 text-xs" style={{ color: "var(--color-fg-muted)" }}>
                {t("planLoading")}
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
            title={t("tRemoveAttachment")}
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
