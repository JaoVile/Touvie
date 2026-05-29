"use client";

import { ChevronDown, Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* A small, curated set for routine blocks — workout, study, work, meals,
   rest, chores, leisure. Tune the list here. */
const EMOJIS = [
  "🏃", "🏋️", "🧘", "🚴", "⚽", "🏊",
  "📚", "✏️", "💻", "💼", "📝", "🧠",
  "🍳", "🍽️", "☕", "🥗", "💊", "💧",
  "😴", "🚿", "🧹", "🛒", "🐕", "🌱",
  "🎸", "🎮", "🎨", "🎧", "📺", "✈️",
  "🙏", "❤️", "🔥", "⭐", "💪", "✨",
];

interface Props {
  name: string;
  defaultValue?: string;
  /** Tighter padding/radius to match the compact weekly form inputs. */
  compact?: boolean;
}

/**
 * Emoji picker for a routine block's icon. A compact trigger (shows the
 * chosen emoji, or a Smile placeholder) opens a grid. The selection is
 * carried by a hidden input so it submits with the parent <form>.
 *
 * The popup is portaled to <body> and fixed-positioned under the trigger so
 * it isn't clipped by the FoldCard's `overflow: hidden`.
 */
export function EmojiPicker({ name, defaultValue = "", compact = false }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Escolher emoji"
        className={`flex w-full items-center justify-between gap-1 border outline-none transition focus:ring-2 ${
          compact ? "rounded px-2 py-1" : "rounded-lg px-3 py-2"
        }`}
        style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-fg)" }}
      >
        {value ? (
          <span className="text-base leading-none">{value}</span>
        ) : (
          <Smile size={16} style={{ color: "var(--color-fg-subtle)" }} />
        )}
        <ChevronDown size={14} style={{ color: "var(--color-fg-subtle)" }} />
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={popRef}
              className="fixed z-[10000] rounded-lg border p-2 shadow-2xl"
              style={{
                top: pos.top,
                left: pos.left,
                background: "var(--color-bg-elevated)",
                borderColor: "var(--color-border)",
              }}
            >
              <div className="grid grid-cols-6 gap-1">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      setValue(e);
                      setOpen(false);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-md text-lg leading-none transition hover:scale-110"
                    style={
                      value === e
                        ? { background: "color-mix(in srgb, var(--color-accent) 24%, transparent)" }
                        : undefined
                    }
                  >
                    {e}
                  </button>
                ))}
              </div>
              {value ? (
                <button
                  type="button"
                  onClick={() => {
                    setValue("");
                    setOpen(false);
                  }}
                  className="mt-1.5 w-full rounded-md py-1 text-eyebrow uppercase tracking-[0.1em] transition hover:opacity-80"
                  style={{ color: "var(--color-fg-subtle)" }}
                >
                  Limpar
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
