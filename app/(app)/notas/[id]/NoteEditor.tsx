"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { deleteNote, saveNote, togglePin } from "../actions";

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
}

type Status = "idle" | "dirty" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 1200;
const MILESTONES = [
  { days: 100, badge: "🥇" },
  { days: 30, badge: "🥈" },
  { days: 7, badge: "🥉" },
];

export function milestoneFor(streak: number): string | null {
  return MILESTONES.find((m) => streak >= m.days)?.badge ?? null;
}

export function NoteEditor({ note }: { note: Note }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tagsRaw, setTagsRaw] = useState(note.tags.join(", "));
  const [pinned, setPinned] = useState(note.pinned);
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Reset if navigating between notes (same component)
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset intencional só ao trocar de nota (note.id); os demais campos são apenas semente inicial e não devem re-disparar
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setTagsRaw(note.tags.join(", "));
    setPinned(note.pinned);
    setStatus("idle");
  }, [note.id]);

  function scheduleFlush(t: string, c: string, tags: string) {
    if (timer.current) clearTimeout(timer.current);
    setStatus("dirty");
    timer.current = setTimeout(() => flush(t, c, tags), DEBOUNCE_MS);
  }

  function flush(t: string, c: string, tags: string) {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setStatus("saving");
    saveNote(note.id, { title: t, content: c, tags })
      .then((res) => setStatus(res.error ? "error" : "saved"))
      .catch(() => setStatus("error"));
  }

  async function handlePin() {
    const next = !pinned;
    setPinned(next);
    await togglePin(note.id, next);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Apagar esta nota permanentemente?")) return;
    await deleteNote(note.id);
  }

  useEffect(() => {
    function onUnload() {
      if (timer.current) {
        clearTimeout(timer.current);
        saveNote(note.id, { title, content, tags: tagsRaw });
      }
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [note.id, title, content, tagsRaw]);

  const statusLabel: Record<Status, string> = {
    idle: "—",
    dirty: "alterado",
    saving: "salvando…",
    saved: "salvo",
    error: "erro ao salvar",
  };
  const statusColor: Record<Status, string> = {
    idle: "var(--color-fg-subtle)",
    dirty: "var(--color-fg-muted)",
    saving: "var(--color-accent)",
    saved: "var(--color-success)",
    error: "var(--color-danger)",
  };

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePin}
            className="rounded-lg border px-3 py-1.5 text-sm transition hover:opacity-80"
            style={{
              borderColor: "var(--color-border)",
              color: pinned ? "var(--color-accent)" : "var(--color-fg-muted)",
            }}
            title={pinned ? "Desafixar" : "Fixar nota"}
          >
            {pinned ? "📌 Fixada" : "📌 Fixar"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg border px-3 py-1.5 text-sm transition hover:opacity-80"
            style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
          >
            Apagar
          </button>
        </div>
        <span className="text-xs" style={{ color: statusColor[status] }}>
          {statusLabel[status]}
        </span>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleFlush(e.target.value, content, tagsRaw);
        }}
        placeholder="Título da nota"
        className="w-full rounded-lg border px-4 py-2 text-lg font-semibold outline-none focus:ring-2"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-card)",
          color: "var(--color-fg)",
        }}
      />

      {/* Content */}
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          scheduleFlush(title, e.target.value, tagsRaw);
        }}
        placeholder="Escreva aqui…"
        spellCheck
        className="min-h-[480px] w-full resize-y rounded-lg border p-4 font-mono text-sm leading-relaxed outline-none focus:ring-2"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-card)",
          color: "var(--color-fg)",
        }}
      />

      {/* Tags */}
      <div>
        <label
          htmlFor="note-tags"
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--color-fg-muted)" }}
        >
          Tags (separadas por vírgula)
        </label>
        <input
          id="note-tags"
          type="text"
          value={tagsRaw}
          onChange={(e) => {
            setTagsRaw(e.target.value);
            scheduleFlush(title, content, e.target.value);
          }}
          placeholder="ex: ideia, lembrete, projeto"
          className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-card)",
            color: "var(--color-fg)",
          }}
        />
        {tagsRaw.trim() ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {tagsRaw
              .split(",")
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean)
              .map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{ background: "var(--color-border)", color: "var(--color-fg-muted)" }}
                >
                  #{tag}
                </span>
              ))}
          </div>
        ) : null}
      </div>

      <p className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>
        {wordCount(content)} palavras
      </p>
    </div>
  );
}

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}
