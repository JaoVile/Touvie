"use client";

import { TimePicker } from "@/components/TimePicker";
import { GlassCard } from "@/components/glass/GlassCard";
import { Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { EmojiPicker } from "./EmojiPicker";
import { deleteWeeklyBlock, saveWeeklyBlock } from "./actions";

interface Block {
  id: string;
  weekday: number;
  block: string;
  title: string;
  emoji: string | null;
  notes: string | null;
}

const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
// map display index → weekday (0=sun,1=mon,...)
const DAY_MAP = [1, 2, 3, 4, 5, 6, 0];

export function WeeklyGrid({ blocks }: { blocks: Block[] }) {
  const [adding, setAdding] = useState<number | null>(null);

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {DAY_MAP.map((weekday, i) => {
        const dayBlocks = blocks.filter((b) => b.weekday === weekday);
        return (
          <GlassCard key={weekday}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">{DAYS[i]}</h3>
              <button
                type="button"
                onClick={() => setAdding(adding === weekday ? null : weekday)}
                className="btn-chip text-eyebrow font-semibold uppercase tracking-[0.1em]"
              >
                {adding === weekday ? (
                  <>
                    <X size={12} strokeWidth={2.25} />
                    Fechar
                  </>
                ) : (
                  <>
                    <Plus size={12} strokeWidth={2.25} />
                    Adicionar
                  </>
                )}
              </button>
            </div>
            {adding === weekday ? (
              <WeeklyForm weekday={weekday} onDone={() => setAdding(null)} />
            ) : null}
            <ul className="space-y-1.5 text-sm">
              {dayBlocks.length === 0 && adding !== weekday ? (
                <li style={{ color: "var(--color-fg-subtle)" }} className="text-xs italic">
                  vazio
                </li>
              ) : null}
              {dayBlocks.map((b) => (
                <WeeklyRow key={b.id} block={b} />
              ))}
            </ul>
          </GlassCard>
        );
      })}
    </div>
  );
}

function WeeklyRow({ block }: { block: Block }) {
  const [pending, start] = useTransition();
  return (
    <li
      className="flex items-start justify-between gap-2 rounded border p-2"
      style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
    >
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase" style={{ color: "var(--color-fg-muted)" }}>
          {block.block}
        </div>
        <div className="truncate">
          {block.emoji ? <span className="mr-1">{block.emoji}</span> : null}
          {block.title}
        </div>
        {block.notes ? (
          <div className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>
            {block.notes}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Apagar?")) return;
          start(() => deleteWeeklyBlock(block.id));
        }}
        className="text-xs"
        style={{ color: "var(--color-danger)" }}
      >
        ×
      </button>
    </li>
  );
}

function WeeklyForm({ weekday, onDone }: { weekday: number; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();
  function submit(fd: FormData) {
    setErr(undefined);
    start(async () => {
      const res = await saveWeeklyBlock(fd);
      if (res?.error) setErr(res.error);
      else onDone();
    });
  }
  return (
    <form action={submit} className="mb-3 space-y-2 text-xs">
      <input type="hidden" name="weekday" value={weekday} />
      <div className="grid grid-cols-[84px_56px_1fr] gap-1.5">
        <TimePicker name="block" defaultValue="07:00" compact />
        <EmojiPicker name="emoji" compact />
        <input
          name="title"
          placeholder="Título"
          required
          maxLength={120}
          className={inputCls}
          style={inputStyle}
        />
      </div>
      <input name="notes" placeholder="Notas (opcional)" className={inputCls} style={inputStyle} />
      {err ? <p style={{ color: "var(--color-danger)" }}>{err}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded px-3 py-1.5 font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        {pending ? "..." : "Salvar"}
      </button>
    </form>
  );
}

const inputCls = "w-full rounded border px-2 py-1 outline-none";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
