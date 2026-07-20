"use client";

import { WEEKDAY_SHORT } from "@/lib/workout";
import { Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { DayBuilder } from "./DayBuilder";
import { ProgramForm } from "./ProgramForm";
import { deleteProgram, deleteProgramDay, saveProgramDay, setActiveProgram } from "./actions";

interface Program {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

interface Day {
  id: string;
  program_id: string;
  weekday: number;
  name: string;
}

interface DayExercise {
  id: string;
  program_day_id: string;
  exercise_id: string;
  sort_order: number;
  target_sets: number | null;
  target_reps_low: number | null;
  target_reps_high: number | null;
  notes: string | null;
}

interface Exercise {
  id: string;
  name: string;
  muscle_group: string | null;
  notes: string | null;
}

interface Props {
  program: Program;
  days: Day[];
  exByDay: Map<string, DayExercise[]>;
  exercises: Exercise[];
}

export function ProgramCard({ program, days, exByDay, exercises }: Props) {
  const [open, setOpen] = useState(program.active);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  function activate() {
    start(async () => {
      await setActiveProgram(program.id);
    });
  }

  function remove() {
    if (
      !confirm(
        `Apagar "${program.name}"? Sessões antigas mantêm o nome do dia mas perdem o vínculo.`,
      )
    )
      return;
    start(async () => {
      await deleteProgram(program.id);
    });
  }

  return (
    <div
      className="rounded-xl border p-3"
      style={{
        background: "var(--color-card)",
        borderColor: program.active ? "var(--color-accent)" : "var(--color-border)",
      }}
    >
      {editing ? (
        <div>
          <ProgramForm
            defaultValues={{ id: program.id, name: program.name }}
            onDone={() => setEditing(false)}
          />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="mt-1.5 text-[11px]"
            style={{ color: "var(--color-fg-muted)" }}
          >
            cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setOpen((o) => !o)} className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="text-xs">{open ? "▾" : "▸"}</span>
              <span className="font-medium">{program.name}</span>
              {program.active ? (
                <span
                  className="rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  ativo
                </span>
              ) : null}
              <span className="text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
                {days.length} {days.length === 1 ? "dia" : "dias"}
              </span>
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            {!program.active ? (
              <button
                type="button"
                onClick={activate}
                disabled={pending}
                className="rounded border px-2 py-1 text-[11px] hover:opacity-80 disabled:opacity-40"
                style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
              >
                ativar
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded p-1 hover:opacity-80"
              style={{ color: "var(--color-fg-subtle)" }}
              aria-label="Editar programa"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="rounded px-2 py-1 text-[11px] hover:opacity-80 disabled:opacity-40"
              style={{ color: "var(--color-danger)" }}
            >
              apagar
            </button>
          </div>
        </div>
      )}

      {open ? (
        <div className="mt-3 grid gap-2">
          {days.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
              Sem dias. Adicione abaixo (ex: Segunda — Push).
            </p>
          ) : (
            days.map((d) => (
              <DayRow
                key={d.id}
                day={d}
                dayExercises={exByDay.get(d.id) ?? []}
                exercises={exercises}
              />
            ))
          )}
          <DayForm programId={program.id} />
        </div>
      ) : null}
    </div>
  );
}

function DayRow({
  day,
  dayExercises,
  exercises,
}: {
  day: Day;
  dayExercises: DayExercise[];
  exercises: Exercise[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function remove() {
    if (!confirm(`Apagar dia "${day.name}"?`)) return;
    start(async () => {
      await deleteProgramDay(day.id);
    });
  }

  return (
    <div
      className="rounded-lg border p-2"
      style={{ background: "var(--color-bg-elevated)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex-1 text-left text-sm"
        >
          <span className="text-xs">{open ? "▾" : "▸"}</span>{" "}
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
            style={{ background: "var(--color-card)", color: "var(--color-fg-muted)" }}
          >
            {WEEKDAY_SHORT[day.weekday]}
          </span>{" "}
          <span className="font-medium">{day.name}</span>{" "}
          <span className="text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
            ({dayExercises.length} ex.)
          </span>
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="text-[11px] hover:opacity-80 disabled:opacity-40"
          style={{ color: "var(--color-danger)" }}
        >
          ×
        </button>
      </div>
      {open ? (
        <div className="mt-2">
          <DayBuilder dayId={day.id} dayExercises={dayExercises} exercises={exercises} />
        </div>
      ) : null}
    </div>
  );
}

function DayForm({ programId }: { programId: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    setError(undefined);
    start(async () => {
      const res = await saveProgramDay(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form action={submit} className="grid grid-cols-[80px_1fr_auto] gap-1.5 text-xs">
      <input type="hidden" name="program_id" value={programId} />
      <select name="weekday" defaultValue="1" className={inputCls} style={inputStyle}>
        {WEEKDAY_SHORT.map((label, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: dias da semana em ordem fixa, o índice É o valor (weekday 0–6)
          <option key={i} value={i}>
            {label}
          </option>
        ))}
      </select>
      <input
        type="text"
        name="name"
        required
        maxLength={60}
        placeholder="Nome do dia (Push, Pull, Legs…)"
        className={inputCls}
        style={inputStyle}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded px-3 font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        + dia
      </button>
      {error ? (
        <p className="col-span-3 text-[10px]" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}

const inputCls = "rounded border px-2 py-1.5 outline-none";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
