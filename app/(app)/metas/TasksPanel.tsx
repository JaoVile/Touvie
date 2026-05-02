"use client";

import { useState, useTransition } from "react";
import { deleteTask, saveTask, toggleTaskDone } from "./actions";

interface Task {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  done: boolean;
  priority: number;
  goal_id: string | null;
}

interface Goal {
  id: string;
  title: string;
  status: string;
}

export function TasksPanel({ tasks, goals }: { tasks: Task[]; goals: Goal[] }) {
  const [adding, setAdding] = useState(false);
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="space-y-3 text-sm">
      {adding ? (
        <TaskForm goals={goals} onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full rounded-lg border border-dashed px-3 py-2 text-sm hover:opacity-80"
          style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
        >
          + Nova tarefa
        </button>
      )}

      <ul className="space-y-1.5">
        {open.length === 0 && !adding ? (
          <li className="text-xs italic" style={{ color: "var(--color-fg-subtle)" }}>
            Nenhuma tarefa pendente.
          </li>
        ) : null}
        {open.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </ul>

      {done.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs" style={{ color: "var(--color-fg-subtle)" }}>
            ✓ {done.length} concluída{done.length > 1 ? "s" : ""}
          </summary>
          <ul className="mt-2 space-y-1">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const [pending, start] = useTransition();
  return (
    <li
      className="flex items-center justify-between gap-2 rounded border px-2.5 py-2"
      style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={task.done}
          onChange={(e) => start(() => toggleTaskDone(task.id, e.target.checked))}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        <span className={task.done ? "line-through" : ""} style={task.done ? { color: "var(--color-fg-subtle)" } : {}}>
          {task.title}
        </span>
        {task.due_date ? (
          <span className="ml-auto text-xs" style={{ color: "var(--color-fg-subtle)" }}>
            {task.due_date}
          </span>
        ) : null}
      </label>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Apagar?")) return;
          start(() => deleteTask(task.id));
        }}
        className="text-xs"
        style={{ color: "var(--color-danger)" }}
      >
        ×
      </button>
    </li>
  );
}

function TaskForm({ goals, onDone }: { goals: Goal[]; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();
  function submit(fd: FormData) {
    setErr(undefined);
    start(async () => {
      const res = await saveTask(fd);
      if (res?.error) setErr(res.error);
      else onDone();
    });
  }
  const activeGoals = goals.filter((g) => g.status === "active");
  return (
    <form action={submit} className="space-y-2">
      <input
        name="title"
        placeholder="Tarefa (ex: estudar 1h)"
        required
        maxLength={200}
        className={inputCls}
        style={inputStyle}
      />
      <div className="grid grid-cols-2 gap-2 text-xs">
        <input type="date" name="due_date" className={inputCls} style={inputStyle} />
        <select name="goal_id" defaultValue="" className={inputCls} style={inputStyle}>
          <option value="">(sem meta)</option>
          {activeGoals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      </div>
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

const inputCls = "w-full rounded border px-3 py-1.5 text-sm outline-none";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
