"use client";

import { Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Custom time picker — two themed scroll columns (hour / minute) in a portaled
 * popover, replacing the un-stylable native one. Value is carried in a hidden
 * input as `HH:MM` so it submits with the parent <form> like the native input.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function parse(v?: string) {
  if (v && /^\d{1,2}:\d{2}/.test(v)) {
    const [h, m] = v.split(":").map(Number);
    return { h, m };
  }
  return null;
}

interface Props {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  /** Tighter padding/radius to match compact forms. */
  compact?: boolean;
}

export function TimePicker({
  name,
  defaultValue = "",
  placeholder = "--:--",
  compact = false,
}: Props) {
  const [value, setValue] = useState(defaultValue ? defaultValue.slice(0, 5) : "");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minColRef = useRef<HTMLDivElement>(null);

  const cur = parse(value);
  const hour = cur?.h ?? null;
  const min = cur?.m ?? null;

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left });
  };

  useEffect(() => {
    if (!open) return;
    place();
    // Scroll each column to its selected value once rendered.
    const id = window.setTimeout(() => {
      hourColRef.current?.querySelector("[data-selected]")?.scrollIntoView({ block: "center" });
      minColRef.current?.querySelector("[data-selected]")?.scrollIntoView({ block: "center" });
    }, 0);
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node;
      if (!btnRef.current?.contains(n) && !popRef.current?.contains(n)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setHour = (h: number) => setValue(`${pad(h)}:${pad(min ?? 0)}`);
  const setMin = (m: number) => setValue(`${pad(hour ?? 0)}:${pad(m)}`);

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 border outline-none transition focus:ring-2 ${
          compact ? "rounded px-2 py-1 text-xs" : "rounded-lg px-3 py-2 text-sm"
        }`}
        style={{
          background: "var(--color-card)",
          borderColor: "var(--color-border)",
          color: "var(--color-fg)",
        }}
      >
        <span
          style={
            value ? { fontVariantNumeric: "tabular-nums" } : { color: "var(--color-fg-subtle)" }
          }
        >
          {value || placeholder}
        </span>
        <Clock size={compact ? 13 : 15} style={{ color: "var(--color-fg-subtle)" }} />
      </button>

      {open && pos
        ? createPortal(
            <div ref={popRef} className="picker-pop" style={{ top: pos.top, left: pos.left }}>
              <div className="flex gap-2">
                <div>
                  <div
                    className="mb-1 text-center text-[11px] font-semibold uppercase"
                    style={{ color: "var(--color-fg-subtle)" }}
                  >
                    Hora
                  </div>
                  <div ref={hourColRef} className="picker-col w-14">
                    {HOURS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHour(h)}
                        className="picker-opt"
                        data-selected={hour === h || undefined}
                      >
                        {pad(h)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div
                    className="mb-1 text-center text-[11px] font-semibold uppercase"
                    style={{ color: "var(--color-fg-subtle)" }}
                  >
                    Min
                  </div>
                  <div ref={minColRef} className="picker-col w-14">
                    {MINUTES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMin(m)}
                        className="picker-opt"
                        data-selected={min === m || undefined}
                      >
                        {pad(m)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className="mt-2 flex items-center justify-between border-t pt-2"
                style={{ borderColor: "var(--color-border)" }}
              >
                <button
                  type="button"
                  onClick={() => {
                    const n = new Date();
                    setValue(`${pad(n.getHours())}:${pad(n.getMinutes())}`);
                  }}
                  className="text-eyebrow uppercase tracking-[0.1em] transition hover:opacity-80"
                  style={{ color: "var(--color-fg-subtle)" }}
                >
                  Agora
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-eyebrow font-semibold uppercase tracking-[0.1em] transition hover:opacity-80"
                  style={{ color: "var(--color-accent)" }}
                >
                  Pronto
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
