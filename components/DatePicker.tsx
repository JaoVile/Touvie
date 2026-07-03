"use client";

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Custom date picker — a calendar popover styled in the app's theme, replacing
 * the un-stylable native one. Carries the value in a hidden input (ISO
 * `YYYY-MM-DD`) so it submits with the parent <form> exactly like the native
 * input it replaces. The popover is portaled to <body> so it isn't clipped by
 * a FoldCard's `overflow: hidden`.
 */

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
function fromISO(s?: string) {
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return { y, m: m - 1, d };
  }
  return null;
}
const displayBR = (s?: string) => {
  const p = fromISO(s);
  return p ? `${pad(p.d)}/${pad(p.m + 1)}/${p.y}` : "";
};

interface Props {
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  /** Tighter padding/radius to match compact forms. */
  compact?: boolean;
}

export function DatePicker({
  name,
  defaultValue = "",
  placeholder = "dd/mm/aaaa",
  compact = false,
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [view, setView] = useState(() => {
    const s = fromISO(defaultValue);
    const t = new Date();
    return s ? { y: s.y, m: s.m } : { y: t.getFullYear(), m: t.getMonth() };
  });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const sel = fromISO(value);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: efeito de abertura — roda só quando o popover abre, não a cada mudança de valor
  useEffect(() => {
    if (!open) return;
    place();
    const s = fromISO(value);
    const t = new Date();
    setView(s ? { y: s.y, m: s.m } : { y: t.getFullYear(), m: t.getMonth() });
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
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  const cells = useMemo(() => {
    const startDow = new Date(view.y, view.m, 1).getDay();
    const days = new Date(view.y, view.m + 1, 0).getDate();
    const arr: Array<number | null> = [];
    for (let i = 0; i < startDow; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [view]);

  const isToday = (d: number) =>
    today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === d;
  const isSel = (d: number) => sel && sel.y === view.y && sel.m === view.m && sel.d === d;

  const pick = (d: number) => {
    setValue(toISO(view.y, view.m, d));
    setOpen(false);
  };
  const shift = (delta: number) =>
    setView((v) => {
      const m = v.m + delta;
      if (m < 0) return { y: v.y - 1, m: 11 };
      if (m > 11) return { y: v.y + 1, m: 0 };
      return { y: v.y, m };
    });

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
        <span style={value ? undefined : { color: "var(--color-fg-subtle)" }}>
          {displayBR(value) || placeholder}
        </span>
        <Calendar size={compact ? 13 : 15} style={{ color: "var(--color-fg-subtle)" }} />
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={popRef}
              className="picker-pop"
              style={{ top: pos.top, left: pos.left, width: "16.5rem" }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold" style={{ color: "var(--color-fg)" }}>
                  {MONTHS[view.m]} <span style={{ color: "var(--color-fg-subtle)" }}>{view.y}</span>
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => shift(-1)}
                    className="picker-nav"
                    aria-label="Mês anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => shift(1)}
                    className="picker-nav"
                    aria-label="Próximo mês"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="mb-1 grid grid-cols-7 gap-1">
                {WEEKDAYS.map((w, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: cabeçalho fixo de 7 dias (com rótulos repetidos), nunca reordena
                    key={i}
                    className="grid h-7 place-items-center text-[11px] font-semibold uppercase"
                    style={{ color: "var(--color-fg-subtle)" }}
                  >
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {cells.map((d, i) =>
                  d == null ? (
                    // biome-ignore lint/suspicious/noArrayIndexKey: grade de calendário de posição fixa (inclui células vazias), nunca reordena
                    <div key={i} className="h-8" />
                  ) : (
                    <button
                      // biome-ignore lint/suspicious/noArrayIndexKey: grade de calendário de posição fixa, nunca reordena
                      key={i}
                      type="button"
                      onClick={() => pick(d)}
                      className="picker-day"
                      data-selected={isSel(d) || undefined}
                      data-today={isToday(d) || undefined}
                    >
                      {d}
                    </button>
                  ),
                )}
              </div>

              <div
                className="mt-2 flex items-center justify-between border-t pt-2"
                style={{ borderColor: "var(--color-border)" }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setValue("");
                    setOpen(false);
                  }}
                  className="text-eyebrow uppercase tracking-[0.1em] transition hover:opacity-80"
                  style={{ color: "var(--color-fg-subtle)" }}
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const t = new Date();
                    setValue(toISO(t.getFullYear(), t.getMonth(), t.getDate()));
                    setOpen(false);
                  }}
                  className="text-eyebrow font-semibold uppercase tracking-[0.1em] transition hover:opacity-80"
                  style={{ color: "var(--color-accent)" }}
                >
                  Hoje
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
